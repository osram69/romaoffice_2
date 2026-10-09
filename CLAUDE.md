@AGENTS.md

## Cronologia sessioni e memoria di Claude Code

La cronologia delle conversazioni (`*.jsonl`) e la memoria automatica di Claude Code per questo progetto vivono normalmente fuori dal repository, in `%USERPROFILE%\.claude\projects\<percorso-della-cartella-con-i-trattini>\` (per `C:\work\romaofficesharing_claude` è `C--work-romaofficesharing-claude`).

Una copia si trova in **`claude-sessions/`** dentro questa cartella, così spostando la cartella su un nuovo PC si porta dietro anche le sessioni. `claude-sessions/` è **escluso da git di proposito**: le trascrizioni possono contenere dati sensibili e il repository è pubblico. Va copiata a mano insieme alla cartella (non arriva con un `git clone`).

- Aggiornare la copia (prima di spostare la cartella): `tools\claude-sessions.cmd export`
- Ripristinare sul nuovo PC (una volta, dopo aver messo la cartella): `tools\claude-sessions.cmd import`

Lo script ricava da solo il nome della cartella di Claude dal percorso in cui si trova il progetto, quindi funziona anche se sul nuovo PC il percorso è diverso (le sessioni compaiono comunque per quel percorso). Non sovrascrive mai un file più recente con uno più vecchio.
