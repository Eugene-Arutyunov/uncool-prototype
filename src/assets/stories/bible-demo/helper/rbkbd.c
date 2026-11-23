/* rbkbd: starts rbible.exe, centres its window on the desktop, then forwards characters written by the web page
   into C:\rbkbd.bin (u32 total character count + the most recent characters as UTF-16LE) to the focused window as WM_CHAR. */
#define IMP __declspec(dllimport)
typedef void* H; typedef unsigned long D;
IMP H __stdcall CreateFileA(const char*,D,D,void*,D,D,H);
IMP int __stdcall ReadFile(H,void*,D,D*,void*);
IMP int __stdcall CloseHandle(H);
IMP void __stdcall Sleep(D);
IMP unsigned __stdcall WinExec(const char*,unsigned);
IMP H __stdcall GetForegroundWindow(void);
IMP D __stdcall GetWindowThreadProcessId(H,D*);
IMP int __stdcall GetGUIThreadInfo(D, void*);
IMP int __stdcall PostMessageW(H,unsigned,unsigned,long);
IMP H __stdcall FindWindowA(const char*,const char*);
IMP int __stdcall IsWindowVisible(H);
IMP int __stdcall MoveWindow(H,int,int,int,int,int);
IMP int __stdcall GetSystemMetrics(int);
#define MARGIN 32   /* desktop left visible around the program window, in pixels */
#define INVALID ((H)(long)-1)
static const char path[] = "C:\\rbkbd.bin";
void entry(void) {
    volatile unsigned char buf[516];
    D gi[12]; D n, last = 0, i, seq, cnt;
    D seen = 0;
    H h, fg, target;
    h = CreateFileA(path, 0x40000000, 3, 0, 2 /*CREATE_ALWAYS*/, 0x80, 0);
    if (h != INVALID) CloseHandle(h);
    WinExec("rbible.exe", 1);
    for (;;) {
        Sleep(30);
        /* Once the program window is up, centre it on the desktop with a margin on every side,
           so the whole window is visible in the web page. Repeated a second later in case the
           program resizes itself during startup. */
        if (seen < 40) {
            h = FindWindowA("RBibleFrameWindow", 0);
            if (!h) h = GetForegroundWindow();
            if (h && IsWindowVisible(h)) {
                seen++;
                if (seen == 1 || seen == 40)
                    MoveWindow(h, MARGIN, MARGIN, GetSystemMetrics(0) - 2 * MARGIN, GetSystemMetrics(1) - 2 * MARGIN, 1);
            }
        }
        h = CreateFileA(path, 0x80000000, 3, 0, 3 /*OPEN_EXISTING*/, 0x80, 0);
        if (h == INVALID) continue;
        n = 0;
        ReadFile(h, (void*)buf, 512, &n, 0);
        CloseHandle(h);
        if (n < 6) continue;
        seq = buf[0] | (buf[1] << 8) | (buf[2] << 16) | ((D)buf[3] << 24);
        cnt = seq - last;               /* characters typed since the last poll */
        if (!cnt) continue;
        last = seq;
        if (cnt > (n - 4) / 2) cnt = (n - 4) / 2;
        fg = GetForegroundWindow();
        if (!fg) continue;
        target = fg;
        for (i = 0; i < 12; i++) gi[i] = 0;
        gi[0] = 48;
        if (GetGUIThreadInfo(GetWindowThreadProcessId(fg, 0), gi) && gi[3]) target = (H)gi[3];
        for (i = 4 + ((n - 4) / 2 - cnt) * 2; i + 1 < n; i += 2)
            PostMessageW(target, 0x0102 /*WM_CHAR*/, buf[i] | (buf[i+1] << 8), 1);
    }
}
