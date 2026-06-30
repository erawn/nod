class NodException(Exception):
    """Exception raised for custom error in the application."""

    def __init__(self, message):
        super().__init__(message)
        self.message = message

    def __str__(self):
        return f"{self.message})"
