!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Instalar Volt Corp"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente instala o Volt Corp Desktop e registra o certificado interno usado para validar as proximas versoes do aplicativo."
  !define MUI_FINISHPAGE_TITLE "Volt Corp pronto para uso"
  !define MUI_FINISHPAGE_TEXT "A instalacao foi concluida. O aplicativo e o certificado interno da equipe foram configurados nesta maquina."
  !define MUI_COMPONENTSPAGE_SMALLDESC
  !ifndef MUI_BGCOLOR
    !define MUI_BGCOLOR "FFFFFF"
  !endif
  !ifndef MUI_TEXTCOLOR
    !define MUI_TEXTCOLOR "0F172A"
  !endif
!macroend

!macro customInstall
  DetailPrint "Removendo variavel ELECTRON_RUN_AS_NODE que impede o Electron de iniciar..."
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::SetEnvironmentVariable(''ELECTRON_RUN_AS_NODE'',$$null,''User''); [Environment]::SetEnvironmentVariable(''ELECTRON_RUN_AS_NODE'',$$null,''Machine'')"'
  Pop $0

  IfFileExists "$INSTDIR\resources\certificates\VoltCorp-Internal-Code-Signing.cer" 0 certificate_missing
    DetailPrint "Registrando certificado interno do Volt Corp..."
    nsExec::ExecToLog '"$SYSDIR\certutil.exe" -addstore -f Root "$INSTDIR\resources\certificates\VoltCorp-Internal-Code-Signing.cer"'
    Pop $0
    nsExec::ExecToLog '"$SYSDIR\certutil.exe" -addstore -f TrustedPublisher "$INSTDIR\resources\certificates\VoltCorp-Internal-Code-Signing.cer"'
    Pop $0
    DetailPrint "Certificado interno registrado."
    Goto certificate_done

  certificate_missing:
    DetailPrint "Certificado interno nao encontrado no pacote."

  certificate_done:
!macroend
