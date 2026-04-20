    def tracing_function(frame: FrameType, event: str, arg: Any):
        if event == "call":  # only get function calls
            module_name = frame.f_globals.get("__name__")
            if module_name in modules:
                frame_info = inspect.getframeinfo(frame)
                if frame.f_back is None:
                    # TODO
                    parent_frame_info = None
                else:
                    parent_frame_info = inspect.getframeinfo(frame.f_back)

                if len(
                    [
                        fr
                        for fr in relevant_stack_frames
                        if compare_identifiers(fr, frame_info)
                    ]
                ) > 0 or (
                    parent_frame_info is not None
                    and compare_identifiers(notebook_parent_frame, parent_frame_info)
                ):  # only get calls in modules we're interested in
                    print("FOUND FRAME")
                    print(frame)
                    # print(arg)
                    return tracing_function
        return None

    sys.setprofile(tracing_function)  # type: ignore