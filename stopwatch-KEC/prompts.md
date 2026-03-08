# Prompt Trail

Chatbot used: OpenAI Codex (GPT-5.4)

## Initial user prompt

```text
##Act as a senior software engineer specialized in frontend.

##Create a stopwatch and countdown web page.


##Technical criteria:
1.Separate the html and javascript code into index.html and script.js (there are seed files in the folder template-KEC)
2.Use JS Vanilla
3.Apply the SOLID principles
4.Implement all necesary logs in the console
5.Catch all possible exceptions
6.For CSS, use Tailwind
7.It must be a responsive website

##Functional criteria:
You can use as a reference the following web: https://www.online-stopwatch.com/
I am attaching several screenshots. Clone the appearance and functionality seen in the screenshots. The names of the screenshot files are important, as they refer to which screen it is.
"INITIAL SCREEN" should be the first screen. STOPWATCH screenshots are the screenshots for the stopwatch functionality. COUNTDOWN screenshots are the screenshots for the countdown functionality.


##Ask me all the extra information that you need before building it.
```

## Clarification requested by Codex

```text
1. Tailwind integration: should I use the Tailwind CDN in stopwatch-KEC/index.html, or do you want a local Tailwind build setup? The repo currently has no Tailwind pipeline.
2. Countdown end behavior: when the countdown reaches 00:00:00, should it only stop visually, or also play a sound / flash / vibrate?
3. Scope of the clone: do you want only the screens shown in the screenshots, or should I also add extras from the reference site such as keyboard shortcuts, fullscreen, or lap/split support?
4. Delivery scope: should I create only stopwatch-KEC/index.html and stopwatch-KEC/script.js, or also add prompts.md as requested in the repo README?
5. Flow confirmation: I’m reading the screenshots as INITIAL SCREEN -> Stopwatch mode and INITIAL SCREEN -> Countdown keypad -> Countdown running/paused/finished. Confirm that this is the intended screen flow.
```

## User answers

```text
1. Use the CDN.
2. It should flash and play a strong sound.
3. Do not add any extras from the reference site.
4. Yes, add a prompts.md with our conversation.
5. Correct.
```

## Final working prompt summary

```text
Build a responsive stopwatch and countdown webpage inside stopwatch-KEC using only index.html and script.js, vanilla JavaScript, Tailwind via CDN, SOLID-oriented separation of responsibilities, console logging for relevant state changes, and defensive exception handling. Match the screenshots for the initial selector screen, stopwatch states, countdown keypad, and countdown runtime states. When the countdown reaches zero, make the page flash and play a strong sound. Do not add extra features from the reference site. Include this prompt trail in prompts.md.
```
