import { expect, test } from '@jupyterlab/galata';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */
test.use({ autoGoto: false });

test('should emit an activation console message', async ({ page }) => {
  const logs: string[] = [];

  page.on('console', message => {
    logs.push(message.text());
  });

  await page.goto();

  expect(
    logs.filter(s => s === 'JupyterLab extension {{ labextension_name }} is activated!')
  ).toHaveLength(1);
});
test('should display {{ mimetype_name }} data file', async ({ page }) => {
  const filename = 'test{{ file_extension }}';
  await page.menu.clickMenuItem('File>New>Text File');

  // Set MIME type content in fill
  await page.getByRole('main').getByRole('textbox').fill('');

  await page.menu.clickMenuItem('File>Save Text');

  await page.locator('.jp-Dialog').getByRole('textbox').fill(filename);

  await page.getByRole('button', { name: 'Rename' }).click();
  await page.waitForTimeout(200);

  // Close file opened as editor
  await page.activity.closePanel('test.my_type');

  await page.filebrowser.open(filename);

  const view = page.getByRole('main').locator('.mimerenderer-{{ mimetype_name }}');

  expect(await view.screenshot()).toMatchSnapshot('{{ mimetype_name }}-file.png');
});

test('should display notebook {{ mimetype_name }} output', async ({ page }) => {
  await page.menu.clickMenuItem('File>New>Notebook');

  await page.getByRole('button', { name: 'Select' }).click();

  await page.notebook.setCell(
    0,
    'code',
    `from IPython.display import display
# Example of MIME type content
output = {
    "{{ mimetype }}": ""
}

display(output, raw=True)`
  );

  await page.notebook.run();

  const outputs = page
    .getByRole('main')
    .locator('.mimerenderer-{{ mimetype_name }}.jp-OutputArea-output');

  await expect(outputs).toHaveCount(1);
});
// import { expect, test } from '@jupyterlab/galata';
// import { JupyterServer } from '@jupyterlab/testutils';
// // import { spawn } from 'child_process';
// // import { JSONObject, PromiseDelegate, UUID } from '@lumino/coreutils';
// // import { sleep } from '@jupyterlab/testing';
// /**
//  * Don't load JupyterLab webpage before running the tests.
//  * This is required to ensure we capture all log messages.
//  */
// test.use({ autoGoto: false });
// const server = new JupyterServer();
// beforeAll(async () => {
//   await server.start();
// }, 30000);

// afterAll(async () => {
//   await server.shutdown();
// });
// // test('should emit an activation console message', async ({ page, tmpPath }) => {
// //   const env = {
// //     // JUPYTER_CONFIG_DIR: Private.handleConfig(options),
// //     // JUPYTER_DATA_DIR: Private.handleData(options),
// //     // JUPYTER_RUNTIME_DIR: Private.mktempDir('jupyter_runtime'),
// //     // IPYTHONDIR: Private.mktempDir('ipython'),
// //     PATH: process.env.PATH
// //   };
// //   // await page.contents.uploadFile(
// //   //     path.resolve(__dirname, `./notebooks/${fileName}`),
// //   //     `${tmpPath}/${fileName}`
// //   // );

// //   //     await page.notebook.openByPath(`${tmpPath}/${fileName}`);
// //   //     await page.notebook.activate(fileName);
// //   //     expect(await page.notebook.isOpen(fileName)).toBeTruthy();
// //   //     expect(await page.notebook.isActive(fileName)).toBeTruthy();

// //   //     await page.notebook.runCell(1); //import pagebreak_ip extension
// //   //     await page.notebook.waitForRun(1);
// //   //     await page.waitForTimeout(1000);
// //   //     await page.notebook.runCellByCell();
// //   //     await page.notebook.waitForRun(6);
// //   //     expect(await page.getByText('a = 2').count()).toBeGreaterThanOrEqual(1);
// //   //     expect(
// //   //       await page.getByText("NameError: name 'b' is not defined").count()
// //   //     ).toBeGreaterThanOrEqual(1);
// //   //   });

// //   // Create the child process for the server.

// //   const startDelegate = new PromiseDelegate<string>();
// //   const child = spawn('nod -e python -m ', { env });
// //   // child.
// //   //     page.notebook.
// //   //     page.on('console', message => {
// //   //         logs.push(message.text());
// //   //     });

// //   await page.goto();

// //   // expect(
// //   //     logs.filter(s => s === 'JupyterLab extension nod is activated!')
// //   // ).toHaveLength(1);
// // });
