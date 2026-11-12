import { Fd } from "../core/proc.js";
import { Pipe } from "../io/stream.js";
import type { Sys } from "../core/sys.js";
import type { RvMemory } from "./mem64.js";

const EPOLLIN = 1;
const EPOLLOUT = 4;
const EPOLLET = 0x80000000;
const EPOLLONESHOT = 0x40000000;
const MAX_COUNTER = 0xfffffffffffffffen;
const CLOEXEC = 0x80000;
const NONBLOCK = 0x800;

interface Counter {
  readonly kind: "eventfd";
  value: bigint;
  readonly semaphore: boolean;
  nonblock: boolean;
  refs: number;
}
interface Watch {
  readonly target: Device | Fd;
  events: number;
  data: bigint;
  previous: number;
  armed: boolean;
}
interface Poller {
  readonly kind: "epoll";
  readonly watches: Map<number, Watch>;
  refs: number;
}
type Device = Counter | Poller;

/** Linux eventfd and epoll compatibility descriptors for the RV64 host bridge. */
export class RvLinuxEvents {
  private readonly devices = new Map<number, Device>();
  private readonly waiters = new Set<() => void>();
  private readonly pipeSubscriptions = new Map<Pipe, () => void>();

  constructor(
    private readonly sys: Sys,
    private readonly memory: () => RvMemory,
    private readonly check: (at: bigint, size: number, write: boolean) => void,
  ) {}

  has(fd: number): boolean { return this.devices.has(fd); }

  private allocate(device: Device, clo: boolean): number {
    const fd = this.sys.k.fd(this.sys.p);
    this.sys.p.fds.set(fd, new Fd(undefined, undefined, undefined, true, true, false, clo));
    this.devices.set(fd, device);
    return fd;
  }

  createEpoll(flags: number): number {
    if (flags & ~CLOEXEC) return -22;
    return this.allocate({ kind: "epoll", watches: new Map(), refs: 1 }, !!(flags & CLOEXEC));
  }

  createEventfd(initial: number, flags: number): number {
    if (flags & ~(CLOEXEC | NONBLOCK | 1)) return -22;
    return this.allocate({
      kind: "eventfd",
      value: BigInt(initial),
      semaphore: !!(flags & 1),
      nonblock: !!(flags & NONBLOCK),
      refs: 1,
    }, !!(flags & CLOEXEC));
  }

  duplicate(oldFd: number, newFd: number): void {
    const device = this.devices.get(oldFd);
    if (!device || oldFd === newFd) return;
    this.detach(newFd);
    device.refs++;
    this.devices.set(newFd, device);
  }

  close(fd: number): void {
    this.detach(fd);
    for (const device of new Set(this.devices.values())) {
      if (device.kind === "epoll") device.watches.delete(fd);
    }
    this.refreshPipeWatches();
    this.changed();
  }

  private detach(fd: number): void {
    const device = this.devices.get(fd);
    if (!device) return;
    this.devices.delete(fd);
    device.refs--;
    if (device.refs > 0) return;
    if (device.kind === "epoll") device.watches.clear();
    for (const other of new Set(this.devices.values())) {
      if (other.kind !== "epoll") continue;
      for (const [key, watch] of other.watches) {
        if (watch.target === device) other.watches.delete(key);
      }
    }
    this.changed();
  }

  flags(fd: number): number | undefined {
    const device = this.devices.get(fd);
    if (!device) return undefined;
    return 2 | (device.kind === "eventfd" && device.nonblock ? NONBLOCK : 0);
  }

  setStatusFlags(fd: number, flags: number): boolean {
    const device = this.devices.get(fd);
    if (!device) return false;
    if (device.kind === "eventfd") device.nonblock = !!(flags & NONBLOCK);
    return true;
  }

  async read(fd: number, at: bigint, length: number): Promise<bigint | undefined> {
    const device = this.devices.get(fd);
    if (!device) return undefined;
    if (device.kind !== "eventfd" || length < 8) return -22n;
    this.check(at, 8, true);
    while (device.value === 0n) {
      if (device.nonblock) return -11n;
      await this.waitChange(-1);
      if (!this.devices.has(fd)) return -9n;
    }
    const result = device.semaphore ? 1n : device.value;
    device.value = device.semaphore ? device.value - 1n : 0n;
    this.memory().set64(at, result);
    this.changed();
    return 8n;
  }

  async write(fd: number, at: bigint, length: number): Promise<bigint | undefined> {
    const device = this.devices.get(fd);
    if (!device) return undefined;
    if (device.kind !== "eventfd" || length < 8) return -22n;
    this.check(at, 8, false);
    const value = this.memory().u64(at);
    if (value === 0xffffffffffffffffn) return -22n;
    while (value > MAX_COUNTER - device.value) {
      if (device.nonblock) return -11n;
      await this.waitChange(-1);
      if (!this.devices.has(fd)) return -9n;
    }
    device.value += value;
    this.changed();
    return 8n;
  }

  private ready(target: Device | Fd): number {
    if (target instanceof Fd) {
      let result = 0;
      if (target.input instanceof Pipe && target.input.readable) result |= EPOLLIN;
      if (target.output instanceof Pipe && target.output.writable) result |= EPOLLOUT;
      if (target.output && !(target.output instanceof Pipe)) result |= EPOLLOUT;
      return result;
    }
    if (target.kind !== "eventfd") return 0;
    return (target.value > 0n ? EPOLLIN : 0) |
      (target.value < MAX_COUNTER ? EPOLLOUT : 0);
  }

  readiness(fd: number, mask: number): number | undefined {
    const target = this.devices.get(fd) ?? this.sys.p.fds.get(fd);
    return target ? this.ready(target) & mask : undefined;
  }

  ctl(epfd: number, op: number, fd: number, at: bigint): number {
    const poller = this.devices.get(epfd);
    if (!poller || poller.kind !== "epoll") return -9;
    if (!this.sys.p.fds.has(fd)) return -9;
    if (epfd === fd) return -22;
    const present = poller.watches.has(fd);
    if (op === 2) {
      if (!present) return -2;
      poller.watches.delete(fd);
      this.refreshPipeWatches();
      this.changed();
      return 0;
    }
    if (op !== 1 && op !== 3) return -22;
    if (op === 1 && present) return -17;
    if (op === 3 && !present) return -2;
    const target = this.devices.get(fd) ?? this.sys.p.fds.get(fd);
    if (!target) return -9;
    if (!(target instanceof Fd) && target.kind === "epoll") return -22;
    if (target instanceof Fd && target.path && !target.input && !target.output) return -1;
    if (!at) return -14;
    this.check(at, 12, false);
    poller.watches.set(fd, {
      target,
      events: this.memory().u32(at),
      data: this.memory().u64(at + 4n),
      previous: 0,
      armed: true,
    });
    this.refreshPipeWatches();
    this.changed();
    return 0;
  }

  private collect(poller: Poller, at: bigint, limit: number): number {
    let count = 0;
    for (const watch of poller.watches.values()) {
      const ready = this.ready(watch.target) & watch.events;
      const triggered = watch.events & EPOLLET ? ready & ~watch.previous : ready;
      watch.previous = ready;
      if (!watch.armed || !triggered) continue;
      const position = at + BigInt(count * 12);
      this.memory().set32(position, triggered >>> 0);
      this.memory().set64(position + 4n, watch.data);
      count++;
      if (watch.events & EPOLLONESHOT) watch.armed = false;
      if (count === limit) break;
    }
    return count;
  }

  async wait(epfd: number, at: bigint, limit: number, timeout: number): Promise<number> {
    const poller = this.devices.get(epfd);
    if (!poller || poller.kind !== "epoll") return -9;
    if (limit < 1 || limit > 4096 || timeout < -1) return -22;
    if (!at) return -14;
    this.check(at, limit * 12, true);
    let count = this.collect(poller, at, limit);
    if (count || timeout === 0) return count;
    await this.waitChange(timeout);
    count = this.collect(poller, at, limit);
    return this.devices.get(epfd) === poller ? count : -9;
  }

  private refreshPipeWatches(): void {
    const active = new Set<Pipe>();
    for (const device of new Set(this.devices.values())) {
      if (device.kind !== "epoll") continue;
      for (const watch of device.watches.values()) {
        if (!(watch.target instanceof Fd)) continue;
        if (watch.target.input instanceof Pipe) active.add(watch.target.input);
        if (watch.target.output instanceof Pipe) active.add(watch.target.output);
      }
    }
    for (const [pipe, unsubscribe] of this.pipeSubscriptions) {
      if (active.has(pipe)) continue;
      unsubscribe();
      this.pipeSubscriptions.delete(pipe);
    }
    for (const pipe of active) {
      if (this.pipeSubscriptions.has(pipe)) continue;
      this.pipeSubscriptions.set(pipe, pipe.onChange(() => this.changed()));
    }
  }

  private changed(): void {
    for (const device of new Set(this.devices.values())) {
      if (device.kind !== "epoll") continue;
      for (const watch of device.watches.values()) {
        watch.previous &= this.ready(watch.target);
      }
    }
    for (const wake of [...this.waiters]) wake();
  }

  private async waitChange(timeout: number): Promise<void> {
    await new Promise<void>(resolve => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (): void => {
        this.waiters.delete(finish);
        if (timer !== undefined) clearTimeout(timer);
        resolve();
      };
      this.waiters.add(finish);
      if (timeout >= 0) timer = setTimeout(finish, timeout);
    });
  }
}
