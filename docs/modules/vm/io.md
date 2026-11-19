# Native descriptor I/O

`NativeIo` shares descriptor semantics between the Thistle32 and Thistle64 interpreters. Reads preserve unread standard-input bytes, while open flags enforce creation, exclusivity, truncation and append behaviour through the calling process's `Sys` interface. Address width and guest memory validation remain with each interpreter.
