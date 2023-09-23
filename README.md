# DaydreamOwo
 Use Daydream controller(s) with OwoTrack/SlimeVr

WARNING: Janky code made by piecing stuff together

# Requirements
 * Daydream controller (the daydream.js claims that the latest firmware doesn't allow connecting via browser, i don't have the new firmware, so i don't know)
 * SlimeVr Server V0.7.1 (new ones doen't work? not sure why)

# How to use
if you are using the released version just run start.bat
you will need to edit start bat to provide your daydream controller id, follow the instructions in the commandline prompt


if you want to run it manually:
```
  node.exe app.js <detected id>
```

You can find your daydream id by typing

```
  node.exe app.js scan
```



# Credits:
Mr doop for daydream.js http://mrdoob.com/
OwoTrack team
