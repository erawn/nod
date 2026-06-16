import { Dialog } from '@jupyterlab/apputils';
import { nodState } from './state';
import { NotebookPanel } from '@jupyterlab/notebook';
import { getNodInfo, getNodKernel, launchNodKernel } from './kernelHelpers';

export function kernelWaitDialog() {
  if (nodState.Instance().status === 'active') {
    return;
  }
  console.log('dialogID', nodState.Instance().dialogID);
  if (nodState.Instance().dialogID === '') {
    const dialog = new Dialog({
      title: 'Waiting for Nod Kernel...',
      body: 'Call notebook() from a Python file in the same directory',
      buttons: [Dialog.okButton({ label: 'Refresh' })],
      hasClose: false
    });
    nodState.Instance().dialogID = dialog.id;
    dialog.launch().then(result => {
      if (result.button.label === 'Refresh') {
        console.log('DIALOG Clicked');
        kernelWaitDialog();
        checkKernelStatus();
      }
    });
  }
}
let checkKernelPromise: undefined | Promise<void> = undefined;
export async function checkKernelStatus() {
  if (checkKernelPromise === undefined) {
    try {
      checkKernelPromise = checkKernelStatusInner();
      await checkKernelPromise;
    } catch (e) {
      console.error("Check Kernel Status", e)
    } finally {
      checkKernelPromise = undefined
    }

  } else {
    console.log('checkKernelStatus rejected');
  }
}
async function checkKernelStatusInner() {
  console.log('Check Kernel Status');
  const kernelSpecManager = nodState.Instance().app.serviceManager.kernelspecs
  await kernelSpecManager.refreshSpecs()
  const specs = kernelSpecManager.specs?.kernelspecs;
  if (!specs) {
    console.error('NO KERNEL SPECS')
    return;
  }
  const nodKernelInstalled = Object.keys(specs).some(
    name => name === 'nod'
  );
  if (!nodKernelInstalled) {
    console.error("No Nod Kernel Installed!")
    const dialog = new Dialog({
      title: 'Nod Kernel Not Installed!',
      body: 'Nod requires the Nod Kernel. Run \"nod --install-kernel\" in your terminal and restart.',
      buttons: [Dialog.okButton({ label: 'Ok' })],
      hasClose: false
    });
    dialog.launch()
    return
  }
  const manager = nodState.Instance().app.serviceManager.kernels;
  await manager.refreshRunning().then(async () => {
    await getNodKernel().then(async id => {
      if (id === undefined) {
        console.log('setting to inactive and launching new kernel');
        nodState.Instance().status = 'inactive';
        if (nodState.Instance().mode === 'from_cli') {
          kernelWaitDialog();
          await launchNodKernel().then(async id => {
            console.log('returned from launch');

            await getNodInfo().then((success) => {
              if (success) {
                const idSearch = Dialog.tracker.find(
                  dialog => dialog.id === nodState.Instance().dialogID
                );
                if (idSearch !== undefined) {
                  idSearch.reject();
                }
              } else {
                //TODO -- warning message
                console.error("NOD LAUNCH FAILED")
              }

            })
          });
        }

      } else {
        const idSearch = Dialog.tracker.find(
          dialog => dialog.id === nodState.Instance().dialogID
        );
        if (idSearch !== undefined) {
          idSearch.reject();
        }
        console.log("gettingNodInfo")
        await getNodInfo();
      }
    });
  });
}
export function updateLockedUI(panel: NotebookPanel) {
  const state = nodState.Instance();
  if (
    nodState.Instance().locked &&
    panel.id !== nodState.Instance().notebookLockId
  ) {
    panel.content.widgets.forEach(cell =>
      cell.model.setMetadata('editable', false)
    );
    if (!panel.contentHeader.contains(state.readOnlyHeader)) {
      console.log('adding widget');
      panel.contentHeader.addWidget(state.readOnlyHeader);
    }
    state.readOnlyHeader.setHidden(false);
  } else {
    panel.content.widgets.forEach(cell =>
      cell.model.setMetadata('editable', true)
    );
    state.readOnlyHeader.setHidden(true);
    const model = panel.content.model;
    if (model !== null) {
      for (const cell of model.cells) {
        cell.sharedModel.changed.connect((cell, change) => {
          if (change.sourceChange) {
            console.log('Cell source change', change, cell);
            if (!nodState.Instance().locked) {
              nodState.Instance().lock(panel);
              updateLockedUI(panel);
            }
          }
        }, nodState.Instance().app);
      }
    }
  }
}

export function onCurrentNotebookChanged(panel: NotebookPanel) {
  const frame = nodState.Instance().getFrameFromPath(panel.context.path);
  if (frame) {
    const newIndex = nodState.Instance().pythonInfo?.stack_info.indexOf(frame);
    console.log('new index', newIndex);
    if (newIndex !== undefined) {
      nodState.Instance().currentFrameIndex = newIndex;
    }
  }

  updateLockedUI(panel);
  panel.content.model?.cells.changed.connect((cellList, changeArgs) => {
    if (panel.isRevealed) {
      //this means its a user-edit
      updateLockedUI(panel);
    }
  });
}
