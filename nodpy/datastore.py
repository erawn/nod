class LogStore:
    instance = None

    def __new__(cls):
        if cls.instance is None:
            cls.instance = super().__new__(cls)
        return cls.instance

    logs: list[str] = []


# class StartingVariables:
#     instance = None

#     def __new__(cls):
#         if cls.instance is None:
#             cls.instance = super().__new__(cls)
#         return cls.instance

#     app = None
#     variables = {}
