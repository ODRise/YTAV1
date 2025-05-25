# Use YouTube AV1 (Improved)

An enhanced userscript designed to reliably enable and prioritize the AV1 codec for YouTube videos, offering potentially better quality at lower bitrates. Includes advanced configuration and browser capability detection.

## 🎯 Features

- **AV1 Preference**: Sets browser preferences to prioritize AV1 codec for YouTube.
- **Format Overrides**: Modifies browser media detection to report AV1 support, encouraging YouTube to serve AV1. (Configurable)
- **Experiment Flag Configuration**: Adjusts YouTube's internal experiment flags related to AV1 and format selection. (Configurable)
- **AV1 Support Detection**: Tests browser capabilities for AV1 playback using multiple methods.
- **Robust Initialization**: Ensures settings are applied even with YouTube's dynamic loading.
- **Persistent Settings**: Saves user configuration (e.g., debug mode, feature toggles).
- **Tampermonkey Menu**: Provides options to toggle features and check for updates.
- **Debug Mode**: Detailed console logging for troubleshooting.
- **Update Checker**: Allows manual checking for new script versions.

## 🚀 Installation

1.  **Install a userscript manager** (if you don't have one already):
    * **Chrome/Edge**: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
    * **Firefox**: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
    * **Safari**: [Tampermonkey](https://apps.apple.com/us/app/tampermonkey/id1482490089)

2.  **Click the link below to install the script**:
    * [**Install Use YouTube AV1 (Improved)**](https://raw.githubusercontent.com/ODRise/YTAV1/main/use-youtube-av1-improved.user.js)

3.  Your userscript manager should prompt you to confirm the installation.
4.  Once installed, the script should be automatically enabled. A page refresh on YouTube might be necessary for all changes to take full effect.

## 🎛️ Configuration Options

Access settings through the Tampermonkey menu for this script:

-   **Enable Format Overrides**: Toggles whether the script actively overrides `canPlayType` and `MediaSource.isTypeSupported` to favor AV1.
    -   `✅ Enable Format Overrides`
    -   `⚪ Enable Format Overrides`
-   **Enable Experiment Flag Changes**: Toggles whether the script modifies YouTube's internal experiment flags related to AV1.
    -   `✅ Enable Experiment Flag Changes`
    -   `⚪ Enable Experiment Flag Changes`
-   **Debug Mode**: Toggles detailed console logging for troubleshooting.
    -   `✅ Debug Mode`
    -   `⚪ Debug Mode`
-   **Check for Updates**: Manually triggers a check for a newer version of the script.

*Note: ✅ indicates the current setting is enabled, ⚪ indicates it's disabled. A page refresh might be needed for some changes to fully apply, especially format override changes.*

## 📊 How It Works

This script employs several strategies to encourage YouTube to serve AV1 video streams:

1.  **AV1 Support Detection**:
    * Uses `navigator.mediaCapabilities.decodingInfo`, `HTMLVideoElement.canPlayType()`, and `MediaSource.isTypeSupported()` to comprehensively assess the browser's actual AV1 decoding capabilities.

2.  **Preference Setting**:
    * Attempts to set a specific localStorage key (`yt-player-av1-pref`) that YouTube's player checks to determine AV1 preference. This is done via property descriptors and direct assignment for robustness.

3.  **Format Overrides (Configurable)**:
    * If enabled, it intercepts calls to `HTMLVideoElement.prototype.canPlayType` and `MediaSource.isTypeSupported`.
    * For AV1-related MIME types, it reports positive support to YouTube, even if the original browser call might be hesitant (e.g., returning "maybe" or being influenced by other factors).

4.  **Experiment Flag Modification (Configurable)**:
    * If enabled, it monitors and adjusts certain `ytcfg.data_.EXPERIMENT_FLAGS` related to AV1, HDR, and format selection to further favor AV1.

5.  **Initialization & Persistence**:
    * The script runs at `document-start` to apply changes as early as possible.
    * Settings (like debug mode and feature toggles) are stored using Greasemonkey APIs and loaded on each run.

## 🐛 Troubleshooting

-   **AV1 Not Used**:
    * Ensure your browser and hardware actually support AV1 decoding. Check sites like `https://m.youtube.com/*\n//` (About HTML5 section).
    * Verify the script is enabled in Tampermonkey.
    * Enable "Debug Mode" via the Tampermonkey menu and check the browser console (F12) for logs from `[Use YouTube AV1 (Improved)]`. Look for messages about AV1 support detection and preference setting.
    * Ensure "Enable Format Overrides" and "Enable Experiment Flag Changes" are enabled in the menu if you want the full effect.
    * Try clearing YouTube's site data/cache or using a private/incognito window to ensure no old settings interfere.
    * Not all videos on YouTube are available in AV1. It's more common on popular videos or newer uploads.
-   **Menu Options Not Working**:
    * Ensure you are using a compatible and up-to-date userscript manager (Tampermonkey is recommended).
-   **Performance Issues**:
    * AV1 decoding can be more CPU intensive than H.264 or VP9, especially on older hardware without dedicated AV1 decoding capabilities. If you experience stuttering, your hardware might be struggling with AV1. This script can't fix hardware limitations.

### Debug Information
Enable "Debug Mode" from the Tampermonkey menu. Open your browser's developer console (usually F12) and look for messages prefixed with `[Use YouTube AV1 (Improved)]`. This will show details about AV1 support checks, preference settings, and any errors encountered.

You can also get a status object by typing `window.youtubeAV1App.getStatus()` in the console.

## 📝 License

MIT License

## 🤝 Contributing

Suggestions, bug reports, and improvements are welcome. Please open an issue or pull request on the GitHub repository (assuming `https://github.com/ODRise/YTAV1` or the correct URL).