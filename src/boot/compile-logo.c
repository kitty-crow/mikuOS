/* Host-side build tool: the canonical colour.h parser converts Unicode Art
 * Studio markup into exact, precompiled 24-bit ANSI-coloured Unicode.
 * The freestanding C/WASM programme has no libc or file IO dependencies.
 * Copyright (c) 2026 Kitty Crow. */
#define _XOPEN_SOURCE 700
#include "colour.h"
#undef fgets
#undef fputs
#undef puts
#undef mbrtowc
#undef wcwidth

#define MAX_ROWS 96
#define MAX_COLS 256
#define LINE_MAX_BYTES 65536

typedef struct { unsigned char utf8[5]; unsigned char n; int fg, bg; } Cell;
static Cell cells[MAX_ROWS][MAX_COLS];
static int lengths[MAX_ROWS], count;
static int xmin=MAX_COLS, xmax=-1, ymin=MAX_ROWS, ymax=-1;

static int utf8_len(unsigned char first) {
    if (first < 0x80) return 1;
    if ((first & 0xe0) == 0xc0) return 2;
    if ((first & 0xf0) == 0xe0) return 3;
    if ((first & 0xf8) == 0xf0) return 4;
    return 0;
}
static int blank(const unsigned char *bytes,int n) {
    return (n==3 && bytes[0]==0xe2 && bytes[1]==0xa0 && bytes[2]==0x80) ||
           (n==1 && (bytes[0]==' ' || bytes[0]=='\t'));
}
static int color(int r,int g,int b) {return (r<<16)|(g<<8)|b;}
static void parse(const char *line) {
    if(count>=MAX_ROWS){fprintf(stderr,"logo has too many rows\n");exit(1);}
    int fg=-1,bg=-1, col=0;
    const unsigned char *p=(const unsigned char *)line;
    while(*p && *p!='\n' && *p!='\r') {
        size_t tag=0;int r=0,g=0,b=0,d=0,background=0;
        if(*p=='<' && logoCTag((const char*)p,&tag,&r,&g,&b,&d,&background)) {
            if(background) bg=d?-1:color(r,g,b);
            else fg=d?-1:color(r,g,b);
            p+=tag;continue;
        }
        int n=utf8_len(*p);
        if(n==0){fprintf(stderr,"invalid Unicode byte\n");exit(1);}
        if(col>=MAX_COLS){fprintf(stderr,"logo row too wide\n");exit(1);}
        Cell *c=&cells[count][col];
        c->n=(unsigned char)n;c->fg=fg;c->bg=bg;
        for(int i=0;i<n;i++){if(!p[i]){fprintf(stderr,"truncated Unicode\n");exit(1);}c->utf8[i]=p[i];}
        if(!blank(p,n)) {
            if(col<xmin)xmin=col;
            if(col>xmax)xmax=col;
            if(count<ymin)ymin=count;
            if(count>ymax)ymax=count;
        }
        p+=n;col++;
    }
    lengths[count++]=col;
}
static void byte(FILE *out,unsigned char b){fprintf(out,"\\%03o",(unsigned)b);}
static void chars(FILE *out,const char *s){while(*s)byte(out,(unsigned char)*s++);}
static void ansi(FILE *out,int value,int bg){
    char seq[64];
    if(value<0)snprintf(seq,sizeof(seq),"\033[%dm",bg?49:39);
    else snprintf(seq,sizeof(seq),"\033[%d;2;%d;%d;%dm",bg?48:38,(value>>16)&255,(value>>8)&255,value&255);
    chars(out,seq);
}
static void rows(FILE *out,const char *name,int x,int width){
    fprintf(out,"static const char *const %s[%d] = {\n",name,ymax-ymin+1);
    for(int row=ymin;row<=ymax;row++){
        int lastfg=-1,lastbg=-1;
        fprintf(out,"  \"");
        for(int col=x;col<x+width;col++){
            if(col>=lengths[row]){byte(out,' ');continue;}
            Cell *c=&cells[row][col];
            if(c->n==0){byte(out,' ');continue;}
            if(c->fg!=lastfg){ansi(out,c->fg,0);lastfg=c->fg;}
            if(c->bg!=lastbg){ansi(out,c->bg,1);lastbg=c->bg;}
            for(int j=0;j<c->n;j++)byte(out,c->utf8[j]);
        }
        chars(out,"\033[39m\033[49m");
        fprintf(out,"\",\n");
    }
    fprintf(out,"};\n");
}
int main(int argc,char **argv){
    if(argc!=3){fprintf(stderr,"usage: compile-logo logo.txt generated-logo.h\n");return 2;}
    FILE *in=fopen(argv[1],"rb");if(!in){perror(argv[1]);return 1;}
    char line[LINE_MAX_BYTES];
    while(fgets(line,sizeof(line),in)){
        if(logoCDefLine(line))continue;
        parse(line);
    }
    if(ferror(in)){perror("read logo");fclose(in);return 1;}
    fclose(in);
    if(xmax<xmin || ymax<ymin){fprintf(stderr,"logo has no visible glyphs\n");return 1;}
    FILE *out=fopen(argv[2],"wb");if(!out){perror(argv[2]);return 1;}
    int full=xmax-xmin+1, icon=(full>26?26:full);
    fprintf(out,"/* Generated from original Unicode Art Studio export with colour.h. */\n");
    fprintf(out,"#define LOGO_ROWS %d\n#define LOGO_FULL_COLS %d\n#define LOGO_ICON_COLS %d\n",ymax-ymin+1,full,icon);
    rows(out,"logo_full_rows",xmin,full);
    rows(out,"logo_icon_rows",xmin,icon);
    fclose(out);
    fprintf(stderr,"logo: %d columns, %d visible rows, %d-column mobile crop\n",full,ymax-ymin+1,icon);
    return 0;
}
