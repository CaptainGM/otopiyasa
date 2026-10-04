' OtoPiyasa Arabam Bekcisi - pencere acmadan baslatir ve kapanirsa 1 dk sonra yeniden baslatir.
' Gorev Zamanlayici bunu oturum acilinca calistirir (kurulum: arabam-bekci-kur.bat).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = root
If Not fso.FolderExists(root & "\logs") Then fso.CreateFolder(root & "\logs")

cmd = "cmd /c ""set ""PATH=%PATH%;%ProgramFiles%\nodejs"" && npx --yes tsx scripts\arabam-bekci.ts >> logs\arabam-bekci-hata.log 2>&1"""
Do
  rc = sh.Run(cmd, 0, True)
  ' 2 = baska bir kopya zaten calisiyor: tekrar deneme
  If rc = 2 Then Exit Do
  WScript.Sleep 60000
Loop
