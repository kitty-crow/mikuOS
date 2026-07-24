# NERU selector

This directory contains only mikuOS host selection and orchestration.

It does not implement a NERU-specific mikuOS runtime. The CLI selector calls
NERU with the existing `.thistle.base` userland; NERU builds the Linux image
ahead of time and NEMUNEMU provides compatibility inside Linux.

Requests for Thistle, Teto or the default kernel never enter this adapter.
