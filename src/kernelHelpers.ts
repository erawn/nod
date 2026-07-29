import { IDocumentManager } from '@jupyterlab/docmanager';
import { nodState } from './state';
import { nodSchema, nodStudyLogRequest } from './types';
import { Dialog, ISessionContext, showDialog } from '@jupyterlab/apputils';
import { checkKernelStatus, kernelWaitDialog } from './interfaceHelpers';
import { setKernelToOpen, studyLogSend, writeChange } from './messaging';
import { requestAPI } from './request';
import { Kernel } from '@jupyterlab/services';

export async function openNotebookWithNodKernel(
  notebookFile: string,
  docManager: IDocumentManager
) {
  const state = nodState.Instance();
  // console.log(state.nod_cwd)
  if (!notebookFile.startsWith(state.nod_cwd)) {
    console.error('file not under jupyter filetree!');
    return;
  }
  const normalized = docManager.services.contents.normalize(
    notebookFile.replace(state.nod_cwd, '')
  );
  console.log(normalized);

  await state.app.serviceManager.kernels.refreshRunning();
  const nodKernelId = await getNodKernel();

  const existingNotebook = state.tracker.find(
    panel => panel.context.sessionContext.path === notebookFile
  );
  if (existingNotebook) {
    console.log('Existing Notebook with Path', existingNotebook);
    existingNotebook.sessionContext.kernelPreference = {
      // autoStartDefault: false,
      name: 'nod',
      id: nodKernelId,
      shutdownOnDispose: false
    };
    state.app.shell.activateById(existingNotebook.id);
    // state.sessionManager.connectTo
    existingNotebook.context.sessionContext.changeKernel({
      name: 'nod',
      id: state.nodKernelId
    });
  } else {
    console.log('opening', normalized, nodKernelId);
    docManager.openOrReveal(normalized, 'default', {
      name: 'nod',
      id: nodKernelId
    });
  }
}
export async function getNodKernel(): Promise<string | undefined> {
  const app = nodState.Instance().app;
  const kernelManager = app.serviceManager.kernels;

  console.log('Current Nod Kernels ', Array.from(kernelManager.running()));
  const oldKernelId = nodState.Instance().nodKernelId;
  const oldNodKernel = Array.from(kernelManager.running()).find(
    val =>
      val.name === 'nod' &&
      val.id === oldKernelId &&
      val.execution_state &&
      [
        'idle',
        'busy',
        'starting',
        'connected',
        'connecting',
        'restarting'
      ].includes(val.execution_state)
  );
  if (oldNodKernel) {
    console.log(
      'found existing kernel with id and status',
      oldKernelId,
      oldNodKernel.execution_state
    );
    return nodState.Instance().nodKernelId;
  } else {
    const existingNodKernel = Array.from(kernelManager.running()).find(
      val =>
        val.name === 'nod' &&
        val.execution_state &&
        [
          'idle',
          'busy',
          'starting',
          'connected',
          'connecting',
          'restarting'
        ].includes(val.execution_state)
    );
    if (existingNodKernel) {
      nodState.Instance().nodKernelId = existingNodKernel.id;
    } else {
      return undefined;
    }
  }
  return nodState.Instance().nodKernelId;
}

export async function launchNodKernel(
  key?: string
): Promise<Kernel.IKernelConnection | undefined> {
  console.log('launch nod kernel enter');
  const app = nodState.Instance().app;
  const spec = app.serviceManager.kernelspecs.specs?.kernelspecs['nod'];
  if (spec === undefined) {
    console.error('No Nod Spec!');
    return;
  }
  // if (!launching && nodState.Instance().status !== 'active') {
  try {
    if (key !== undefined) {
      await setKernelToOpen(key);
    }
    // launching = true;
    console.log('Launching Nod Kernel');
    // nodState.Instance().tracker.currentWidget?.sessionContext;
    // const currentSessionContext = nodState.Instance().tracker.currentWidget?.sessionContext
    // if (currentSessionContext !== undefined) {
    //   if (currentSessionContext.isDisposed) {
    //     await currentSessionContext.initialize()
    //   }
    // const connection = await currentSessionContext.changeKernel({
    //   name: 'nod',
    // });
    const connection = await app.serviceManager.kernels.startNew(
      {
        name: 'nod'
      },
      {}
    );
    if (connection !== null) {
      nodState.Instance().nodKernelId = connection.model.id;
      console.log(' LAUNCHNODKERNEL: Started Up New Nod!', connection.model.id);
      return connection;
    }

    // } else {
    //   console.error("current session context is undefined/disposed!")
    // }
    // else {

    // }
    // launching = false;
  } catch (e: any) {
    console.log(e);
    const trans = nodState.Instance().translator.load('jupyterlab');
    nodState.Instance().dialogID
    const idSearch = Dialog.tracker.find(
      dialog => dialog.id === nodState.Instance().dialogID
    );
    if (idSearch !== undefined) {
      idSearch.reject();
      nodState.Instance().dialogID = ""
    }
    await showDialog({
      title: trans.__('Error In Python Program \n If \'notebook_on_exception\' is set to \'True\', Notebook will open on error. Otherwise, restart Nod.\n'),
      body: `${e}`,
      buttons: [Dialog.okButton({ ariaLabel: trans.__('OK') })]
    });

    return undefined;
  }
  // }
  return undefined;
}

export async function getNodInfoFromKey(
  key: string
): Promise<nodSchema | undefined> {
  const res = await requestAPI<any>('file', {
    body: key,
    method: 'POST'
  });
  const jsonObj = JSON.parse(atob(res));
  const schema = nodSchema.parse(jsonObj);
  return schema;
}

export async function getNodInfo(): Promise<nodSchema | undefined> {
  const state = nodState.Instance();
  try {
    const connection_path = nodState.Instance().connection_dir;
    if (connection_path === '') {
      console.error('connection dir not provided');
      return;
    }

    const pathToSearch = nodState.Instance().connection_dir + '/nodInfo.json';
    console.log(pathToSearch);
    const res = await requestAPI<any>('file', {
      body: pathToSearch,
      method: 'POST'
    });
    const jsonObj = JSON.parse(atob(res));
    const schema = nodSchema.parse(jsonObj);
    console.log(schema);
    if (state.status !== 'active') {
      console.log('REFRESHING NOD STATE Found Nod Kernel');
      state.pythonInfo = schema;
      state.status = 'active';
      state.dialogID = '';
      state.activateSidebars();
    }
    return schema;
  } catch (e) {
    console.log(e);
    return;
  }
}

/**
 * Restart the session.
 *
 * @returns A promise that resolves with whether the kernel has restarted.
 *
 * #### Notes
 * If there is a running kernel, present a dialog.
 * If there is no kernel, we start a kernel with the last run
 * kernel name and resolves with `true`.
 */
export async function default_restart(
  sessionContext: ISessionContext,
  restartOptions?: ISessionContext.IRestartOptions
): Promise<boolean> {
  const trans = nodState.Instance().translator.load('jupyterlab');
  console.log('default restart');
  await sessionContext.initialize();
  if (sessionContext.isDisposed) {
    throw new Error('session already disposed');
  }
  const kernel = sessionContext.session?.kernel;
  if (!kernel && sessionContext.prevKernelName) {
    await sessionContext.changeKernel({
      name: sessionContext.prevKernelName
    });
    return true;
  }
  // Bail if there is no previous kernel to start.
  if (!kernel) {
    throw new Error('No kernel to restart');
  }

  // Skip the dialog and restart the kernel
  const kernelPluginId = '@jupyterlab/apputils-extension:sessionDialogs';
  const skipKernelRestartDialog =
    sessionContext.kernelPreference?.skipKernelRestartDialog ?? false;
  const skipKernelRestartDialogSetting = (
    await nodState
      .Instance()
      .settingRegistry?.get(kernelPluginId, 'skipKernelRestartDialog')
  )?.composite as boolean;
  if (skipKernelRestartDialogSetting || skipKernelRestartDialog) {
    await sessionContext.restartKernel();
    return true;
  }

  const restartBtn = Dialog.warnButton({
    label: trans.__('Restart'),
    ariaLabel: trans.__('Confirm Kernel Restart')
  });
  const result = await showDialog({
    title: trans.__('Restart Kernel?'),
    body: trans.__(
      'Do you want to restart the kernel of %1? All variables will be lost.',
      sessionContext.name
    ),
    buttons: [
      Dialog.cancelButton({ ariaLabel: trans.__('Cancel Kernel Restart') }),
      restartBtn
    ],
    checkbox: {
      label: trans.__('Do not ask me again.'),
      caption: trans.__(
        'If checked, the kernel will restart without confirmation prompt in the future; you can change this back in the settings.'
      )
    }
  });

  if (kernel.isDisposed) {
    return false;
  }
  if (result.button.accept) {
    if (typeof result.isChecked === 'boolean' && result.isChecked === true) {
      sessionContext.kernelPreference = {
        ...sessionContext.kernelPreference,
        skipKernelRestartDialog: true
      };
    }
    await restartOptions?.onBeforeRestart();
    await sessionContext.restartKernel();
    return true;
  }
  return false;
}

export async function restart(
  sessionContext: ISessionContext,
  restartOptions?: ISessionContext.IRestartOptions
): Promise<boolean> {
  const trans = nodState.Instance().translator.load('jupyterlab');

  await sessionContext.initialize();
  if (sessionContext.isDisposed) {
    throw new Error('session already disposed');
  }
  console.log('session context', sessionContext);
  const kernel = sessionContext.session?.kernel;

  if (kernel?.name !== 'nod') {
    return await default_restart(sessionContext, restartOptions);
  }
  await showDialog({
    title: trans.__('Cannot Restart Nod Kernel'),
    body: trans.__(
      'To restart your Nod Program, press the Restart button in the Nod panel on the left',
      sessionContext.name
    ),
    buttons: [Dialog.okButton({ ariaLabel: trans.__('OK') })]
    // checkbox: {
    //     label: trans.__('Do not ask me again.'),
    //     caption: trans.__(
    //         'If checked, the kernel will restart without confirmation prompt in the future; you can change this back in the settings.'
    //     )
    // }
  });
  return false;
}

export async function NodRestart(): Promise<boolean> {
  // sessionContext: ISessionContext,
  // restartOptions?: ISessionContext.IRestartOptions
  const trans = nodState.Instance().translator.load('jupyterlab');
  const sessionContext =
    nodState.Instance().tracker.currentWidget?.sessionContext;
  if (sessionContext === undefined) {
    await showDialog({
      title: trans.__('No Nod Session To Restart!'),
      body: trans.__("Start a Nod Session Again From the Command Line to Continue"
      )
    });
    return false;
  }

  const kernel = sessionContext.session?.kernel;
  console.log('NOD RESTART', kernel?.name);
  if (!kernel && sessionContext.prevKernelName) {
    console.log('no kernel, opening old');
    await sessionContext.changeKernel({
      name: sessionContext.prevKernelName
    });
    return true;
  }
  // Bail if there is no previous kernel to start.
  if (!kernel) {
    throw new Error('No kernel to restart');
  }
  nodState.Instance().status = 'inactive';

  const nodNoSave = Dialog.warnButton({
    label: trans.__('Restart without Export'),
    ariaLabel: trans.__('Confirm Nod Restart without Saving'),
    accept: true
  });
  const restartBtn = Dialog.createButton({
    label: trans.__('Export and Restart'),
    ariaLabel: trans.__('Confirm Nod Restart')
  });
  const result = await showDialog({
    title: trans.__('Restart Nod Session?'),
    body: trans.__(
      'Do you want to restart the Nod Session of %1? Modifications will be copied back to Source Files.',
      sessionContext.name
    ),
    buttons: [
      Dialog.cancelButton({ ariaLabel: trans.__('Cancel Nod Restart') }),
      nodNoSave,
      restartBtn
    ]
    // checkbox: {
    //     label: trans.__('Do not ask me again.'),
    //     caption: trans.__(
    //         'If checked, the kernel will restart without confirmation prompt in the future; you can change this back in the settings.'
    //     )
    // }
  });
  if (kernel.isDisposed) {
    return false;
  }
  const state = nodState.Instance();

  if (result.button.accept) {
    await nodState.Instance().app.commands.execute('docmanager:save-all');
    if (result.button.label === 'Export and Restart') {
      if (state.notebookLockId !== '') {
        const nbToExport = state.tracker.find(
          panel => panel.id === state.notebookLockId
        );
        if (nbToExport !== undefined) {
          const frame = state.getFrameFromPath(nbToExport.context.path);
          if (frame !== undefined) {
            await writeChange(nbToExport, frame);
          }
        }
      }
    }
    // await restartOptions?.onBeforeRestart();
    const data: nodStudyLogRequest = {
      kind: 'restart',
      restartSave: result.button.label === 'Export and Restart',
      nodInfo: nodState.Instance().pythonInfo ?? undefined,
      key: nodState.Instance().pythonInfo?.key ?? ''
    };
    studyLogSend(data);
    try {
      const restartPromise = sessionContext.session?.kernel?.restart();//sessionContext.restartKernel(); //TODO--let program continue?
      kernelWaitDialog();
      await restartPromise;
      console.log('POST RESTART');
      state.unlock();
      checkKernelStatus();
      return true;
    } catch (e: any) {
      console.log(e);
      const trans = nodState.Instance().translator.load('jupyterlab');
      nodState.Instance().dialogID
      const idSearch = Dialog.tracker.find(
        dialog => dialog.id === nodState.Instance().dialogID
      );
      if (idSearch !== undefined) {
        idSearch.reject();
        nodState.Instance().dialogID = ""
      }
      await showDialog({
        title: trans.__('Error In Python Program \n If \'notebook_on_exception\' is set to \'True\', Notebook will open on error. Otherwise, restart Nod.\n'),
        body: `${e}`,
        buttons: [Dialog.okButton({ ariaLabel: trans.__('OK') })]
      });

    }
  }
  return false;
}

export async function NodSwitchSessions(schema: nodSchema): Promise<boolean> {
  const state = nodState.Instance();
  const trans = nodState.Instance().translator.load('jupyterlab');

  if (state.status === 'active') {
    const nodNoSave = Dialog.warnButton({
      label: trans.__('Switch without Export'),
      ariaLabel: trans.__('Confirm Nod Switch without Saving'),
      accept: true
    });
    const restartBtn = Dialog.createButton({
      label: trans.__('Export Current and Switch'),
      ariaLabel: trans.__('Confirm Nod Switch With Saving')
    });
    const result = await showDialog({
      title: trans.__('Switch Nod Session?'),
      body: trans.__(
        'Do you want to Switch the Nod Session? Modifications will be copied back to Source Files.'
      ),
      buttons: [
        Dialog.cancelButton({ ariaLabel: trans.__('Cancel Nod Switch') }),
        nodNoSave,
        restartBtn
      ]
    });
    if (!result.button.accept) {
      return false;
    }
    await nodState.Instance().app.commands.execute('docmanager:save-all');
    if (result.button.label === 'Export and Restart') {
      if (state.notebookLockId !== '') {
        const nbToExport = state.tracker.find(
          panel => panel.id === state.notebookLockId
        );
        if (nbToExport !== undefined) {
          const frame = state.getFrameFromPath(nbToExport.context.path);
          if (frame !== undefined) {
            await writeChange(nbToExport, frame);
          }
        }
      }
    }
  } else {
    await nodState.Instance().app.commands.execute('docmanager:save-all');
  }
  nodState.Instance().status = 'inactive';
  const existing_schema = await getNodInfo();
  const kernel_id = await getNodKernel();
  console.log(
    'current key',
    existing_schema?.key,
    ' schema key ',
    schema.key,
    kernel_id
  );
  let id = '';
  if (schema.key === existing_schema?.key && kernel_id !== undefined) {
    id = kernel_id;
    console.log('setting id to ', schema.key);
    await state.reset(schema, id);
  } else {
    console.log('launching kernel', schema.key);
    const nodKernelPromise = launchNodKernel(schema.key);
    kernelWaitDialog();
    await nodKernelPromise;
    console.log('POST SWITCH SESSIONS', id);
    await state.reset(schema, id);

    // state.tracker.forEach(panel => {
    //   if (state.getFrameFromPath(panel.context.path) !== undefined) {
    //     const options: Session.ISessionOptions = {
    //       kernel: {
    //         name: 'python'
    //       },
    //       path: 'foo.ipynb',
    //       type: 'notebook',
    //       name: 'foo.ipynb'
    //     };
    //     panel.context.sessionContext.kernelPreference = {

    //     }
    //     panel.context.sessionContext.startKernel()
    //     panel.context.sessionContext.path = connection.
    //       .changeKernel({
    //       name: 'nod',
    //       id: state.nodKernelId
    //     });
    //   }
    // });
    // const sessionContext = state.tracker.currentWidget?.sessionContext
    // if (sessionContext !== undefined && !sessionContext.isDisposed) {
    //   try {
    //     console.log("switching sessions ", id)
    //     await sessionContext.changeKernel({
    //       name: 'nod',
    //       id: id
    //     });
    //   } catch (e) {
    //     console.log('switch sessions error:', e)
    //   }
    // }
  }

  // state.tracker.forEach(panel => {
  //   if (state.getFrameFromPath(panel.context.path) !== undefined) {
  //     panel.context.sessionContext.path =
  //         .changeKernel({
  //       name: 'nod',
  //       id: state.nodKernelId
  //     });
  //   }
  // });
  checkKernelStatus();
  return true;
}
