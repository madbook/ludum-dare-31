copy(btoa(JSON.stringify(
{
  "type": "directory",
  "name": "ssh/",
  "data": [
    {
      "type": "file",
      "name": "readme",
      "data": "good job! use the ssh script to go to the next level."
    },
    {
      "type": "script",
      "name": "connect"
    },
    {
      "type": "host_key",
      "name": "key",
      "data": "NEINO",
      "permission": 1
    },
    {
      "type": "host_file",
      "name": "host",
      "key_data": "NEINO",
      "data": "level2",
      "permission": 1
    },
  ]
}
)))