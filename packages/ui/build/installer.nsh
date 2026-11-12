; Airlock NSIS — optional local data wipe on uninstall (default: keep data).

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
    "Remove Airlock local data and Airlock sandbox images too?$\n$\nThis deletes your Airlock user data folder (including receipt signing keys) and attempts:$\ndocker image rm airlock/sandbox:latest ghcr.io/lukeholmes/airlock-sandbox:latest$\n$\nOther Docker images and containers are not touched. If Docker is not installed, image removal is skipped." \
    IDNO AirlockSkipDataWipe

  RMDir /r "$APPDATA\Airlock"
  RMDir /r "$APPDATA\airlock"
  RMDir /r "$LOCALAPPDATA\Airlock"
  RMDir /r "$LOCALAPPDATA\airlock"

  ClearErrors
  nsExec::ExecToLog 'docker image rm -f airlock/sandbox:latest'
  nsExec::ExecToLog 'docker image rm -f ghcr.io/lukeholmes/airlock-sandbox:latest'

  AirlockSkipDataWipe:
!macroend
