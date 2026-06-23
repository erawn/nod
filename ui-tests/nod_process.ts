//   async shutdown(): Promise < void> {
//     if(!Private.child) {
//     return Promise.resolve(void 0);
// }
// const stopDelegate = new PromiseDelegate<void>();
// const child = Private.child;
// child.on('exit', code => {
//     Private.child = null;
//     if (code !== null && code !== 0) {
//         stopDelegate.reject('child process exited with code ' + String(code));
//     } else {
//         stopDelegate.resolve(void 0);
//     }
// });

// child.kill();
// window.setTimeout(() => {
//     if (Private.child) {
//         Private.child.kill(9);
//     }
// }, 3000);

// return stopDelegate.promise;
//   }
// }
