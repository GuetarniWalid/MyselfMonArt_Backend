; AutoHotkey v2 Script - Simple version
; Just presses Enter when Render Video dialog appears (Render is default button)
;
; Usage:
; 1. Install AutoHotkey v2 (https://www.autohotkey.com/)
; 2. Double-click this file to run
; 3. Press Ctrl+Shift+Q to quit

#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

A_IconTip := "Auto-Render Active (Ctrl+Shift+Q to quit)"

; Check every 300ms
SetTimer(AutoClickRender, 300)

^+q::ExitApp

AutoClickRender() {
    if WinExist("Render Video") {
        WinActivate("Render Video")
        Sleep(150)
        Send("{Enter}")
    }
}
