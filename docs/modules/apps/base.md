# Built-in application contract

`App` describes an application name, description, usage and asynchronous `run` method. The method receives a `Sys` context and argument strings, and resolves to an exit status. Its shared help method writes usage and description to the application output. `FnApp` adapts a synchronous or asynchronous function returning a numeric status to the same application interface.
