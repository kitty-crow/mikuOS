/* mikuOS early loading screen. True status and progress, drawn in C to xterm.
 * Built for wasm32 with no WASI, libc, network or graphics framework.
 * The original Unicode Art Studio glyphs and true colours are compiled
 * from src/boot/logo.txt using the canonical colour.h parser. */
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
static const char *colours[]={"0;0;0", "0;106;129", "0;148;166", "45;206;210"};
#include "generated-logo.h"
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
static void art(int x,int y,int w,int available_rows){
  int full=w>=LOGO_FULL_COLS+4;
  const int count=full?LOGO_FULL_COLS:LOGO_ICON_COLS;
  const char *const *img=full?logo_full_rows:logo_icon_rows;
  if(w<count+4 || available_rows<=0)return;
  int x0=x+(w-count)/2;
  int n=min(available_rows,LOGO_ROWS);
  int from=(LOGO_ROWS-n)/2;
  for(int k=0;k<n;k++){
    move(x0,y+k);
    put(img[from+k]);
  }
}
static void draw(void){
 if(!started)return;
 used=0;
 put("\033[H\033[2J\033[?25l");
 int width=min(cols-2,94);
 if(width<26){move(1,1);fg(3);put("mikuOS  ");spinner_x=9;spinner_y=1;put(spin[frame%4]);reset();move(1,2);put(labels[stage]);}
 else{
  int x=(cols-width)/2+1, h=min(rows-2,22), top=(rows-h)/2+1;
  if(top<1)top=1;
  /* A compact dark Classic Mac-style framed panel, without HTML/CSS. */
  for(int py=0;py<h;py++){move(x,top+py);bg(0);fg(1);chr('|');for(int j=0;j<width-2;j++)chr(' ');chr('|');reset();}
  fg(2);move(x,top);chr('+');for(int j=0;j<width-2;j++)chr('-');chr('+');
  centre("Loading mikuOS",top+1,width,x);
  reset();
  if(width>=LOGO_ICON_COLS+4 && h>=18)art(x,top+3,width,h>=22?LOGO_ROWS:h-10);
  else{move(x+3,top+3);fg(3);put("mikuOS boot");reset();}
  int line=top+h-5;
  spinner_x=x+2;spinner_y=line;
  move(spinner_x,spinner_y);fg(3);put(spin[frame%4]);reset();chr(' ');
  const char *label=labels[stage];
  int room=width-7;
  for(int i=0;label[i] && i<room;i++)chr(label[i]);
  int barline=line+2;move(x+2,barline);
  int n=width-4;
  int bp=(stage*100)/8;
  if(total>0 && loaded>0)bp=(stage*100)/8+(loaded*100)/(total*8);
  if(bp>100)bp=100;
  fg(2);for(int j=0;j<n;j++)put(j*100<bp*n?"\342\226\210":"\342\226\221");reset();
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
