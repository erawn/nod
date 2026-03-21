# nod

<!-- https://stackoverflow.com/questions/31382405/ipython-notebook-how-to-connect-to-existing-kernel?rq=3 -->
404 GET /api/kernels/e9d194aa-bfbc-495d-8295-593039ab17e8/channels?session_id=6740bec7-2acd-4d6f-a6e2-33973306dfa4 (127.0.0.1): Kernel does not exist: e9d194aa-bfbc-495d-8295-593039ab17e8

Session not found: session_id='2e3651ad-e58a-41ec-8b90-ce370cf3d153'



SIGNALS
- SIGINT
    - should pause execution of kernel, not send to notebook process, and not reset state


- SIGKILL

- SIGTERM

COMMANDS
- shutdown

- restart button
    - launches kernel again



TODO
- show side panel on start
- grey out shutdown button
- test timeouts to optimize (and on networked connections?)
- on export and exit, close the window? 
- test restart on in-place operations
- dont orphan notebook process when sent "quit" 
save cell output -- display somehow in main code? 
- add exit without saving to menu
- autosplit option
- mark cells above nod() call as run? 
- mode to create function at call site? 
- add param to nod() for stack frame/indent depth?
- Add check interface where it shows side by side 
Settings 
- format for notebook converstion with jupytext (light, percent, etc)
- name the kernel something unique in the menu
- remove kernel actions from pallette 
- make current test notebook with same name, only add iid to previous versions