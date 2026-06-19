!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Instalar SorDChat"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente instala o SorDChat Desktop e registra o certificado interno usado para validar as proximas versoes do aplicativo."
  !define MUI_FINISHPAGE_TITLE "SorDChat pronto para uso"
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
  IfFileExists "$INSTDIR\resources\certificates\SorDChat-Internal-Code-Signing.cer" 0 certificate_missing
    DetailPrint "Registrando certificado interno do SorDChat..."
    nsExec::ExecToLog '"$SYSDIR\certutil.exe" -addstore -f Root "$INSTDIR\resources\certificates\SorDChat-Internal-Code-Signing.cer"'
    Pop $0
    nsExec::ExecToLog '"$SYSDIR\certutil.exe" -addstore -f TrustedPublisher "$INSTDIR\resources\certificates\SorDChat-Internal-Code-Signing.cer"'
    Pop $0
    DetailPrint "Certificado interno registrado."
    Goto certificate_done

  certificate_missing:
    DetailPrint "Certificado interno nao encontrado no pacote."

  certificate_done:
!macroend
