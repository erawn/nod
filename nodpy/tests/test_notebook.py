import os
import shlex
import subprocess
import time


def test_nod(capsys):
    nb_env = os.environ.copy()
    nb_process = subprocess.Popen(
        shlex.split("nod python -m moduletest"),
        env=nb_env,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    stdout = nb_process.stdout
    stderr = nb_process.stderr
    time.sleep(5)
    if stdout is not None and stderr is not None:
        os.set_blocking(stdout.fileno(), False)  # type: ignore
        os.set_blocking(stderr.fileno(), False)  # type: ignore
        stdout.flush()
        stderr.flush()
        for line in iter(stdout.readline, ""):
            if len(line) == 0:
                break
            print(line)
        for line in iter(stderr.readline, ""):
            if len(line) == 0:
                break
            print(line)

    nb_process.terminate()
    nb_process.wait()
    captured = capsys.readouterr()
    print(captured.out)
    print(captured.err)
    assert "nod: reached notebook(), starting session" in captured.out
