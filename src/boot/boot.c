/* mikuOS early loading screen. True status and progress, drawn in C to xterm.
 * Built for wasm32 with no WASI, libc, network or graphics framework.
 * The palette-mapped pixels derive from Kitty Crow's supplied mikuOS SVG. */
__attribute__((import_module("env"), import_name("emit")))
extern void emit(const char *bytes, int size);
static char screen[20000];
static int used, cols=60, rows=24, stage, loaded, total, frame, started;
static int spinner_x=1, spinner_y=1;
static const char *labels[]={
 "Loading mikuOS runtime", "Preparing browser runtime", "Reading guest filesystem index",
 "Unpacking guest filesystem", "Restoring persistent changes", "Initialising execution kernel",
 "Initialising userland", "Preparing interactive shell", "Starting mikuOS session"
};
static const char *spin[]={"|","/","-","\\"};
static const char *colours[]={"22;24;29", "0;106;129", "0;148;166", "45;206;210"};
static const char wide_logo[]="020000000002200000000000000000000000000000022200000022200000000000000000000000000000022220002222200000000000000000000000000000022222222222200000000000000000000000000000012222222222100000000000000000000000000000332112222212330000000000000000000000000000333300221233330000000000030000000022000220333333323333330000000003030000000222202221333333333333330003333303030333032200222200123333333332210033033333333033032200020222221122332211220033030333333033030200220002222211111122220033030333333333330122202222022222222222000000000000000000000002000000000022222200000000000000000000000000000000";
static const char small_logo[]="220000002000000000000000000000222000222000000000000000000000122222222000000000000000000000321222212300000000000000000000333022233300000000000000020020333333333300000003300002222221333333333200333333333032002222212233211100333333333332202022222111222000300033033330220122002222220000000000000000000000";
static void put(const char *s){while(*s && used<19995)screen[used++]=*s++;}
static void chr(char c){if(used<19995)screen[used++]=c;}
static void num(int n){char b[12];int p=0;if(n<=0){chr('0');return;}while(n && p<11){b[p++]=(char)('0'+n%10);n/=10;}while(p)chr(b[--p]);}
static void move(int x,int y){put("\033[");num(y);chr(';');num(x);chr('H');}
static void fg(int index){put("\033[38;2;");put(colours[index]);chr('m');}
static void bg(int index){put("\033[48;2;");put(colours[index]);chr('m');}
static void reset(void){put("\033[0m");}
static int length(const char *s){int n=0;while(s[n])n++;return n;}
static int min(int x,int y){return x<y?x:y;}
static void centre(const char *s,int y,int w,int x){int n=length(s);move(x+((w-n)/2>0?(w-n)/2:0),y);put(s);}
static void art(int x,int y,int w){
 const char *logo=w>=42?wide_logo:small_logo;
 const int width=w>=42?42:30, height=w>=42?14:10;
 int start=x+(w-width)/2;
 for(int sy=0;sy<height;sy+=2){
  move(start,y+sy/2);
  for(int sx=0;sx<width;sx++){
   int upper=logo[sy*width+sx]-'0';
   int lower=logo[(sy+1)*width+sx]-'0';
   fg(upper);bg(lower);put("\342\226\200");
  }
  reset();
 }
}
static void draw(void){
 if(!started)return;
 used=0;
 put("\033[H\033[2J\033[?25l");
 int width=min(cols-2,64);
 if(width<26){move(1,1);fg(3);put("mikuOS  ");spinner_x=9;spinner_y=1;put(spin[frame%4]);reset();move(1,2);put(labels[stage]);}
 else{
  int x=(cols-width)/2+1, h=18, top=(rows-h)/2+1;
  if(top<1)top=1;
  fg(2);move(x,top);chr('+');for(int j=0;j<width-2;j++)chr('-');chr('+');
  centre("mikuOS",top+1,width,x);
  reset();
  if(width>=34 && rows>=14)art(x,top+3,width);
  else{move(x+3,top+3);fg(3);put("mikuOS boot");reset();}
  int line=top+(rows>=14?12:5);
  if(line>=rows-3)line=rows-3;
  spinner_x=x+2;spinner_y=line;
  move(spinner_x,spinner_y);fg(3);put(spin[frame%4]);reset();chr(' ');
  const char *label=labels[stage];
  int room=width-7;
  for(int i=0;label[i] && i<room;i++)chr(label[i]);
  int barline=line+2;move(x+2,barline);
  int n=width-4;
  int bp=(stage*100)/8;
  if(stage==0 && total>0 && loaded>0)bp=(loaded*100)/(total*8);
  if(bp>100)bp=100;
  fg(2);for(int j=0;j<n;j++)put(j*100<bp*n?"\342\226\210":"\342\226\221");reset();
  move(x+2,barline+1);fg(3);put(" ");num(bp);put("%  ");reset();
  move(x,top+h-1);fg(2);chr('+');for(int j=0;j<width-2;j++)chr('-');chr('+');reset();
 }
 emit(screen,used);
}
__attribute__((export_name("boot_start"))) void boot_start(int width,int height){
 cols=width>0?width:60;rows=height>0?height:24;stage=0;loaded=0;total=0;frame=0;
 started=1;static const char alternate[]="\033[?1049h\033[?25l";emit(alternate,sizeof(alternate)-1);draw();
}
__attribute__((export_name("boot_update"))) void boot_update(int phase,int done,int size){
 if(phase<0||phase>8)return;
 if(phase<stage)return;
 stage=phase;loaded=done<0?0:done;total=size<0?0:size;draw();
}
/* Update only the spinner cell on each tick. The expensive logo and
 * progress bar are redrawn exclusively when an actual boot event occurs. */
__attribute__((export_name("boot_tick"))) void boot_tick(void){
 if(!started)return;
 frame++;used=0;move(spinner_x,spinner_y);
 fg(3);put(spin[frame%4]);reset();emit(screen,used);
}
__attribute__((export_name("boot_resize"))) void boot_resize(int width,int height){cols=width>0?width:60;rows=height>0?height:24;draw();}
__attribute__((export_name("boot_finish"))) void boot_finish(void){
 if(!started)return;started=0;static const char done[]="\033[?1049l\033[?25h";emit(done,sizeof(done)-1);
}
