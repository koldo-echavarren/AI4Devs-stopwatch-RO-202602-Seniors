"use strict";

(() => {
  const SCREEN = Object.freeze({
    INITIAL: "initial",
    STOPWATCH: "stopwatch",
    COUNTDOWN_SETUP: "countdown-setup",
    COUNTDOWN_RUNTIME: "countdown-runtime",
  });

  class Logger {
    constructor(scope) {
      this.scope = scope;
    }

    info(message, details) {
      this.write(console.info, message, details);
    }

    warn(message, details) {
      this.write(console.warn, message, details);
    }

    error(message, details) {
      this.write(console.error, message, details);
    }

    formatMessage(message) {
      return `[${this.scope}] ${message}`;
    }

    write(writer, message, details) {
      if (typeof details === "undefined") {
        writer(this.formatMessage(message));
        return;
      }

      writer(this.formatMessage(message), details);
    }
  }

  class ErrorBanner {
    constructor(element) {
      this.element = element;
    }

    show(message) {
      if (!this.element) {
        return;
      }

      this.element.textContent = message;
      this.element.classList.remove("hidden");
    }

    clear() {
      if (!this.element) {
        return;
      }

      this.element.textContent = "";
      this.element.classList.add("hidden");
    }
  }

  class SafeExecutor {
    static wrap(label, task, logger, errorBanner) {
      return (...args) => {
        try {
          const result = task(...args);

          if (result && typeof result.then === "function") {
            result.catch((error) => {
              SafeExecutor.handleFailure(label, error, logger, errorBanner);
            });
          }

          return result;
        } catch (error) {
          SafeExecutor.handleFailure(label, error, logger, errorBanner);
          return undefined;
        }
      };
    }

    static run(label, task, logger, errorBanner, fallbackValue = undefined) {
      try {
        return task();
      } catch (error) {
        SafeExecutor.handleFailure(label, error, logger, errorBanner);
        return fallbackValue;
      }
    }

    static handleFailure(label, error, logger, errorBanner) {
      logger.error(`${label} failed`, error);
      errorBanner.show("An unexpected error occurred. Check the console for details.");
    }
  }

  class ElementResolver {
    constructor(documentRef) {
      this.documentRef = documentRef;
    }

    byId(id) {
      const element = this.documentRef.getElementById(id);

      if (!element) {
        throw new Error(`Required element "#${id}" was not found.`);
      }

      return element;
    }

    all(selector) {
      return Array.from(this.documentRef.querySelectorAll(selector));
    }
  }

  class TimeFormatter {
    static formatMilliseconds(totalMilliseconds) {
      const safeMilliseconds = Math.max(0, Math.floor(totalMilliseconds));
      const hours = Math.floor(safeMilliseconds / 3_600_000);
      const minutes = Math.floor((safeMilliseconds % 3_600_000) / 60_000);
      const seconds = Math.floor((safeMilliseconds % 60_000) / 1_000);
      const milliseconds = safeMilliseconds % 1_000;

      return {
        full: `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`,
        milliseconds: this.pad(milliseconds, 3),
      };
    }

    static digitsToDurationMilliseconds(digits) {
      const normalizedDigits = digits.replace(/\D/g, "").slice(-6).padStart(6, "0");
      const hours = Number(normalizedDigits.slice(0, 2));
      const minutes = Number(normalizedDigits.slice(2, 4));
      const seconds = Number(normalizedDigits.slice(4, 6));

      return ((hours * 60 + minutes) * 60 + seconds) * 1_000;
    }

    static digitsToDisplay(digits) {
      const totalMilliseconds = this.digitsToDurationMilliseconds(digits);
      return this.formatMilliseconds(totalMilliseconds);
    }

    static formatCountdownMilliseconds(totalMilliseconds) {
      const safeMilliseconds = Math.max(0, Math.floor(totalMilliseconds));
      const milliseconds = safeMilliseconds % 1_000;
      const displaySeconds =
        safeMilliseconds === 0
          ? 0
          : milliseconds > 0
            ? Math.floor(safeMilliseconds / 1_000) + 1
            : Math.floor(safeMilliseconds / 1_000);
      const hours = Math.floor(displaySeconds / 3_600);
      const minutes = Math.floor((displaySeconds % 3_600) / 60);
      const seconds = displaySeconds % 60;

      return {
        full: `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`,
        milliseconds: this.pad(milliseconds, 3),
      };
    }

    static pad(value, size = 2) {
      return String(value).padStart(size, "0");
    }
  }

  class StopwatchService {
    constructor(logger) {
      this.logger = logger;
      this.reset();
    }

    start() {
      if (this.running) {
        this.logger.warn("Stopwatch start ignored because it is already running.");
        return;
      }

      this.startedAt = performance.now();
      this.running = true;
      this.logger.info("Stopwatch started.", { elapsedMilliseconds: this.elapsedMilliseconds });
    }

    pause() {
      if (!this.running) {
        this.logger.warn("Stopwatch pause ignored because it is not running.");
        return;
      }

      this.elapsedMilliseconds = this.currentElapsedMilliseconds();
      this.startedAt = 0;
      this.running = false;
      this.logger.info("Stopwatch paused.", { elapsedMilliseconds: this.elapsedMilliseconds });
    }

    reset() {
      this.elapsedMilliseconds = 0;
      this.startedAt = 0;
      this.running = false;
      this.logger.info("Stopwatch reset.");
    }

    snapshot() {
      const elapsedMilliseconds = this.currentElapsedMilliseconds();

      return {
        elapsedMilliseconds,
        running: this.running,
      };
    }

    currentElapsedMilliseconds() {
      if (!this.running) {
        return this.elapsedMilliseconds;
      }

      return this.elapsedMilliseconds + (performance.now() - this.startedAt);
    }
  }

  class CountdownService {
    constructor(logger) {
      this.logger = logger;
      this.clear();
    }

    configure(durationMilliseconds) {
      if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
        throw new Error("Countdown duration must be greater than zero.");
      }

      this.initialDurationMilliseconds = Math.floor(durationMilliseconds);
      this.remainingMilliseconds = this.initialDurationMilliseconds;
      this.deadline = 0;
      this.running = false;
      this.completed = false;
      this.logger.info("Countdown configured.", {
        durationMilliseconds: this.initialDurationMilliseconds,
      });
    }

    start() {
      if (!this.isConfigured()) {
        throw new Error("Countdown cannot start before it is configured.");
      }

      if (this.running) {
        this.logger.warn("Countdown start ignored because it is already running.");
        return;
      }

      if (this.completed || this.remainingMilliseconds <= 0) {
        this.remainingMilliseconds = this.initialDurationMilliseconds;
        this.completed = false;
        this.logger.info("Countdown restarted from the original duration.");
      }

      this.deadline = performance.now() + this.remainingMilliseconds;
      this.running = true;
      this.logger.info("Countdown started.", {
        remainingMilliseconds: this.remainingMilliseconds,
      });
    }

    pause() {
      if (!this.running) {
        this.logger.warn("Countdown pause ignored because it is not running.");
        return;
      }

      this.remainingMilliseconds = Math.max(0, this.deadline - performance.now());
      this.deadline = 0;
      this.running = false;
      this.logger.info("Countdown paused.", {
        remainingMilliseconds: this.remainingMilliseconds,
      });
    }

    clear() {
      this.initialDurationMilliseconds = 0;
      this.remainingMilliseconds = 0;
      this.deadline = 0;
      this.running = false;
      this.completed = false;
      this.logger.info("Countdown cleared.");
    }

    snapshot() {
      let justCompleted = false;

      if (this.running) {
        this.remainingMilliseconds = Math.max(0, this.deadline - performance.now());

        if (this.remainingMilliseconds === 0) {
          this.running = false;
          this.deadline = 0;

          if (!this.completed) {
            justCompleted = true;
          }

          this.completed = true;
          this.logger.info("Countdown completed.");
        }
      }

      return {
        remainingMilliseconds: this.remainingMilliseconds,
        initialDurationMilliseconds: this.initialDurationMilliseconds,
        running: this.running,
        configured: this.isConfigured(),
        completed: this.completed,
        justCompleted,
      };
    }

    isConfigured() {
      return this.initialDurationMilliseconds > 0;
    }
  }

  class AlarmService {
    constructor(logger, flashTarget) {
      this.logger = logger;
      this.flashTarget = flashTarget;
      this.audioContext = null;
      this.intervalId = 0;
      this.active = false;
      this.audioUnavailableLogged = false;
      this.audioSkippedLogged = false;
    }

    async prepare() {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

      if (!AudioContextConstructor) {
        if (!this.audioUnavailableLogged) {
          this.logger.warn("Web Audio API is not available. Flash alarm will still work.");
          this.audioUnavailableLogged = true;
        }
        return;
      }

      if (!this.audioContext) {
        this.audioContext = new AudioContextConstructor();
        this.logger.info("Alarm audio context created.");
      }

      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
        this.logger.info("Alarm audio context resumed.");
      }

      if (this.audioContext.state === "running") {
        this.audioSkippedLogged = false;
      }
    }

    async start() {
      if (this.active) {
        this.logger.warn("Alarm start ignored because the alarm is already active.");
        return;
      }

      this.active = true;
      this.flashTarget.classList.add("flash-alarm");
      this.logger.warn("Alarm activated.");

      try {
        await this.prepare();
      } catch (error) {
        this.logger.warn("Alarm audio preparation failed. Flashing will continue without sound.", error);
      }

      this.playPattern();
      this.intervalId = window.setInterval(() => {
        this.playPattern();
      }, 1_050);

      if (typeof navigator.vibrate === "function") {
        navigator.vibrate([300, 120, 300, 120, 500]);
      }
    }

    stop() {
      if (!this.active && !this.intervalId) {
        return;
      }

      this.active = false;
      this.flashTarget.classList.remove("flash-alarm");

      if (this.intervalId) {
        window.clearInterval(this.intervalId);
        this.intervalId = 0;
      }

      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(0);
      }

      this.logger.info("Alarm stopped.");
    }

    playPattern() {
      if (!this.audioContext || this.audioContext.state !== "running") {
        if (!this.audioSkippedLogged) {
          this.logger.warn("Alarm sound skipped because the audio context is not running.");
          this.audioSkippedLogged = true;
        }
        return;
      }

      this.audioSkippedLogged = false;

      const pattern = [
        { offset: 0, frequency: 880, duration: 0.16, type: "sawtooth" },
        { offset: 0.2, frequency: 1_060, duration: 0.16, type: "square" },
        { offset: 0.4, frequency: 1_260, duration: 0.24, type: "sawtooth" },
      ];

      const anchorTime = this.audioContext.currentTime + 0.02;

      pattern.forEach((tone) => {
        this.scheduleTone(anchorTime + tone.offset, tone.frequency, tone.duration, tone.type);
      });
    }

    scheduleTone(startTime, frequency, duration, type) {
      try {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.24, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + duration + 0.04);
      } catch (error) {
        this.logger.error("Scheduling an alarm tone failed.", error);
      }
    }
  }

  class AppController {
    constructor(dependencies) {
      this.logger = dependencies.logger;
      this.errorBanner = dependencies.errorBanner;
      this.stopwatch = dependencies.stopwatch;
      this.countdown = dependencies.countdown;
      this.alarm = dependencies.alarm;
      this.elements = dependencies.elements;

      this.countdownDigits = "";
      this.activeScreen = SCREEN.INITIAL;
      this.animationFrameId = 0;
      this.lastStopwatchDisplay = "";
      this.lastCountdownSetupDisplay = "";
      this.lastCountdownRuntimeDisplay = "";
    }

    init() {
      this.registerGlobalErrorHandlers();
      this.bindEvents();
      this.showScreen(SCREEN.INITIAL);
      this.startAnimationLoop();
      this.logger.info("Application initialized.");
    }

    registerGlobalErrorHandlers() {
      window.addEventListener(
        "error",
        SafeExecutor.wrap(
          "Global error handler",
          (event) => {
            this.logger.error("Unhandled error captured.", event.error || event.message);
            this.errorBanner.show("An unexpected error occurred. Check the console for details.");
          },
          this.logger,
          this.errorBanner
        )
      );

      window.addEventListener(
        "unhandledrejection",
        SafeExecutor.wrap(
          "Unhandled promise rejection handler",
          (event) => {
            this.logger.error("Unhandled promise rejection captured.", event.reason);
            this.errorBanner.show("An unexpected error occurred. Check the console for details.");
          },
          this.logger,
          this.errorBanner
        )
      );
    }

    bindEvents() {
      this.elements.modeButtons.forEach((button) => {
        button.addEventListener(
          "click",
          SafeExecutor.wrap(
            "Mode selection",
            async () => {
              const selectedMode = button.dataset.mode;
              this.errorBanner.clear();
              await this.prepareAlarmSafely();

              if (selectedMode === "stopwatch") {
                this.logger.info("Stopwatch mode selected.");
                this.showScreen(SCREEN.STOPWATCH);
                return;
              }

              if (selectedMode === "countdown") {
                this.logger.info("Countdown mode selected.");
                this.showScreen(SCREEN.COUNTDOWN_SETUP);
                return;
              }

              throw new Error(`Unsupported mode "${selectedMode}".`);
            },
            this.logger,
            this.errorBanner
          )
        );
      });

      this.elements.stopwatchPrimaryButton.addEventListener(
        "click",
        SafeExecutor.wrap(
          "Stopwatch primary action",
          async () => {
            this.errorBanner.clear();
            await this.prepareAlarmSafely();

            const snapshot = this.stopwatch.snapshot();

            if (snapshot.running) {
              this.stopwatch.pause();
            } else {
              this.stopwatch.start();
            }

            this.renderStopwatch();
          },
          this.logger,
          this.errorBanner
        )
      );

      this.elements.stopwatchClearButton.addEventListener(
        "click",
        SafeExecutor.wrap(
          "Stopwatch clear action",
          () => {
            this.errorBanner.clear();
            const snapshot = this.stopwatch.snapshot();

            if (!snapshot.running && snapshot.elapsedMilliseconds === 0) {
              this.logger.info("Stopwatch clear at zero returned the user to the initial screen.");
              this.showScreen(SCREEN.INITIAL);
              return;
            }

            this.stopwatch.reset();
            this.renderStopwatch();
          },
          this.logger,
          this.errorBanner
        )
      );

      this.elements.countdownDigitButtons.forEach((button) => {
        button.addEventListener(
          "click",
          SafeExecutor.wrap(
            "Countdown digit input",
            () => {
              this.errorBanner.clear();
              const digit = button.dataset.digit ?? "";
              const nextDigits = `${this.countdownDigits}${digit}`.replace(/\D/g, "").slice(-6);

              this.countdownDigits = nextDigits;
              this.logger.info("Countdown digit entered.", {
                digit,
                digits: this.countdownDigits,
              });
              this.renderCountdownSetup();
            },
            this.logger,
            this.errorBanner
          )
        );
      });

      this.elements.countdownSetButton.addEventListener(
        "click",
        SafeExecutor.wrap(
          "Countdown set action",
          async () => {
            this.errorBanner.clear();
            await this.prepareAlarmSafely();

            const durationMilliseconds = TimeFormatter.digitsToDurationMilliseconds(this.countdownDigits);

            if (durationMilliseconds <= 0) {
              this.logger.warn("Countdown set ignored because the configured value is zero.");
              this.errorBanner.show("Enter a valid countdown duration before pressing Set.");
              return;
            }

            this.alarm.stop();
            this.countdown.configure(durationMilliseconds);
            this.showScreen(SCREEN.COUNTDOWN_RUNTIME);
          },
          this.logger,
          this.errorBanner
        )
      );

      this.elements.countdownSetupClearButton.addEventListener(
        "click",
        SafeExecutor.wrap(
          "Countdown setup clear action",
          () => {
            this.errorBanner.clear();

            if (this.countdownDigits.length > 0) {
              this.logger.info("Countdown setup digits cleared.");
              this.countdownDigits = "";
              this.renderCountdownSetup();
              return;
            }

            this.logger.info("Countdown setup clear at zero returned the user to the initial screen.");
            this.showScreen(SCREEN.INITIAL);
          },
          this.logger,
          this.errorBanner
        )
      );

      this.elements.countdownPrimaryButton.addEventListener(
        "click",
        SafeExecutor.wrap(
          "Countdown primary action",
          async () => {
            this.errorBanner.clear();
            await this.prepareAlarmSafely();
            this.alarm.stop();

            const snapshot = this.countdown.snapshot();

            if (!snapshot.configured) {
              this.logger.warn("Countdown primary action ignored because the countdown is not configured.");
              return;
            }

            if (snapshot.running) {
              this.countdown.pause();
            } else {
              this.countdown.start();
            }

            this.renderCountdownRuntime();
          },
          this.logger,
          this.errorBanner
        )
      );

      this.elements.countdownRuntimeClearButton.addEventListener(
        "click",
        SafeExecutor.wrap(
          "Countdown runtime clear action",
          () => {
            this.errorBanner.clear();
            this.alarm.stop();
            this.countdown.clear();
            this.countdownDigits = "";
            this.showScreen(SCREEN.COUNTDOWN_SETUP);
          },
          this.logger,
          this.errorBanner
        )
      );
    }

    startAnimationLoop() {
      const renderFrame = SafeExecutor.wrap(
        "Animation frame",
        () => {
          this.renderActiveScreen();
          this.animationFrameId = window.requestAnimationFrame(renderFrame);
        },
        this.logger,
        this.errorBanner
      );

      this.animationFrameId = window.requestAnimationFrame(renderFrame);
      this.logger.info("Animation loop started.");
    }

    showScreen(screen) {
      this.activeScreen = screen;
      this.alarm.flashTarget.classList.toggle("flash-alarm", false);

      const sectionVisibility = {
        [SCREEN.INITIAL]: this.elements.initialScreen,
        [SCREEN.STOPWATCH]: this.elements.stopwatchScreen,
        [SCREEN.COUNTDOWN_SETUP]: this.elements.countdownSetupScreen,
        [SCREEN.COUNTDOWN_RUNTIME]: this.elements.countdownRuntimeScreen,
      };

      Object.entries(sectionVisibility).forEach(([screenName, element]) => {
        element.classList.toggle("screen-hidden", screenName !== screen);
      });

      this.logger.info("Screen rendered.", { screen });
      this.renderActiveScreen(true);
    }

    renderActiveScreen(forceRender = false) {
      if (this.activeScreen === SCREEN.STOPWATCH) {
        this.renderStopwatch(forceRender);
        return;
      }

      if (this.activeScreen === SCREEN.COUNTDOWN_SETUP) {
        this.renderCountdownSetup(forceRender);
        return;
      }

      if (this.activeScreen === SCREEN.COUNTDOWN_RUNTIME) {
        this.renderCountdownRuntime(forceRender);
      }
    }

    renderStopwatch(forceRender = false) {
      const snapshot = this.stopwatch.snapshot();
      const formattedTime = TimeFormatter.formatMilliseconds(snapshot.elapsedMilliseconds);
      const displayKey = `${formattedTime.full}.${formattedTime.milliseconds}`;

      if (forceRender || this.lastStopwatchDisplay !== displayKey) {
        this.elements.stopwatchTime.textContent = formattedTime.full;
        this.elements.stopwatchMilliseconds.textContent = formattedTime.milliseconds;
        this.lastStopwatchDisplay = displayKey;
      }

      if (snapshot.running) {
        this.updatePrimaryButton(this.elements.stopwatchPrimaryButton, "Pause", "primary-running");
        return;
      }

      if (snapshot.elapsedMilliseconds > 0) {
        this.updatePrimaryButton(this.elements.stopwatchPrimaryButton, "Continue", "primary-paused");
        return;
      }

      this.updatePrimaryButton(this.elements.stopwatchPrimaryButton, "Start", "primary-idle");
    }

    renderCountdownSetup(forceRender = false) {
      const formattedTime = TimeFormatter.digitsToDisplay(this.countdownDigits);
      const displayKey = `${formattedTime.full}.${formattedTime.milliseconds}`;

      if (forceRender || this.lastCountdownSetupDisplay !== displayKey) {
        this.elements.countdownSetupTime.textContent = formattedTime.full;
        this.lastCountdownSetupDisplay = displayKey;
      }

      const isSetEnabled = TimeFormatter.digitsToDurationMilliseconds(this.countdownDigits) > 0;
      this.elements.countdownSetButton.disabled = !isSetEnabled;
    }

    renderCountdownRuntime(forceRender = false) {
      const snapshot = this.countdown.snapshot();
      const formattedTime = TimeFormatter.formatCountdownMilliseconds(snapshot.remainingMilliseconds);
      const displayKey = `${formattedTime.full}.${formattedTime.milliseconds}`;

      if (forceRender || this.lastCountdownRuntimeDisplay !== displayKey) {
        this.elements.countdownRuntimeTime.textContent = formattedTime.full;
        this.elements.countdownRuntimeMilliseconds.textContent = formattedTime.milliseconds;
        this.lastCountdownRuntimeDisplay = displayKey;
      }

      if (snapshot.justCompleted) {
        this.logger.warn("Countdown reached zero. Alarm sequence starting.");
        void this.alarm.start();
      }

      this.alarm.flashTarget.classList.toggle("flash-alarm", this.alarm.active);

      if (snapshot.running) {
        this.updatePrimaryButton(this.elements.countdownPrimaryButton, "Pause", "primary-running");
        return;
      }

      if (snapshot.remainingMilliseconds > 0 && snapshot.remainingMilliseconds < snapshot.initialDurationMilliseconds) {
        this.updatePrimaryButton(this.elements.countdownPrimaryButton, "Continue", "primary-paused");
        return;
      }

      this.updatePrimaryButton(this.elements.countdownPrimaryButton, "Start", "primary-idle");
    }

    updatePrimaryButton(button, label, stateClass) {
      button.textContent = label;
      button.classList.remove("primary-idle", "primary-running", "primary-paused");
      button.classList.add(stateClass);
    }

    async prepareAlarmSafely() {
      try {
        await this.alarm.prepare();
      } catch (error) {
        this.logger.warn("Alarm preparation failed. The UI will continue without guaranteed sound playback.", error);
      }
    }
  }

  const bootstrap = () => {
    const logger = new Logger("TimerApp");
    const resolver = new ElementResolver(document);
    const errorBanner = new ErrorBanner(resolver.byId("error-banner"));

    const elements = {
      appRoot: resolver.byId("app"),
      initialScreen: resolver.byId("screen-initial"),
      stopwatchScreen: resolver.byId("screen-stopwatch"),
      countdownSetupScreen: resolver.byId("screen-countdown-setup"),
      countdownRuntimeScreen: resolver.byId("screen-countdown-runtime"),
      modeButtons: resolver.all("[data-mode]"),
      stopwatchTime: resolver.byId("stopwatch-time"),
      stopwatchMilliseconds: resolver.byId("stopwatch-milliseconds"),
      stopwatchPrimaryButton: resolver.byId("stopwatch-primary"),
      stopwatchClearButton: resolver.byId("stopwatch-clear"),
      countdownSetupTime: resolver.byId("countdown-setup-time"),
      countdownDigitButtons: resolver.all("[data-digit]"),
      countdownSetButton: resolver.byId("countdown-set"),
      countdownSetupClearButton: resolver.byId("countdown-setup-clear"),
      countdownRuntimeTime: resolver.byId("countdown-runtime-time"),
      countdownRuntimeMilliseconds: resolver.byId("countdown-runtime-milliseconds"),
      countdownPrimaryButton: resolver.byId("countdown-primary"),
      countdownRuntimeClearButton: resolver.byId("countdown-runtime-clear"),
    };

    const controller = new AppController({
      logger,
      errorBanner,
      stopwatch: new StopwatchService(logger),
      countdown: new CountdownService(logger),
      alarm: new AlarmService(logger, elements.appRoot),
      elements,
    });

    controller.init();
  };

  document.addEventListener(
    "DOMContentLoaded",
    SafeExecutor.wrap(
      "Application bootstrap",
      bootstrap,
      new Logger("Bootstrap"),
      new ErrorBanner(document.getElementById("error-banner"))
    )
  );
})();
