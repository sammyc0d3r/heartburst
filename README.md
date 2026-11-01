<p align="center">
  <img src="icons/icon128.png" width="96" alt="Heartburst icon">
</p>

<h1 align="center">Heartburst</h1>

<p align="center">
  Fill someone's TikTok inbox with love. A small Chrome extension that sends a sweet message to your open chat as many times as you like, up to 100.
</p>

---

This started as a joke. I wanted my girlfriend to open TikTok and find a hundred "I love you"s waiting for her, and typing them out by hand was not happening. It turned out to be just as useful for the other side of a relationship, like a proper "I'm sorry" when one message isn't going to cut it.

You write the message and pick how many times to send it. Heartburst types each one into the TikTok chat you have open and hits send, with a short pause in between. You can also give it a handful of emojis. Each message then ends with three random ones, so the burst looks a bit more alive than the same line copied a hundred times.

## What it looks like

> I love you ❤️🥰✨<br>
> I love you 🌹💕😘<br>
> I love you 💖✨❤️<br>
> …

## Install

It isn't on the Chrome Web Store, so you load it yourself:

1. Download this repo: **Code → Download ZIP**, then unzip it. Or clone it:
   ```bash
   git clone https://github.com/sammyc0d3r/heartburst.git
   ```
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Pin Heartburst from the puzzle-piece menu.

It also works in Edge, Brave and other Chromium browsers.

## Use

1. Go to [tiktok.com/messages](https://www.tiktok.com/messages) and open the chat with your person.
2. Click the Heartburst icon.
3. On the **Message** tab, type your message, choose how many to send (up to 100) and how long to wait between each one.
4. Optional: open the **Emojis** tab and paste at least three emojis to pick from. Your list is saved for next time.
5. Press **Start sending**. Keep the TikTok tab open until it's finished. You can press **Stop** at any time.

Your message, count and emojis are saved locally, so they're ready the next time you open it.

## Ideas

- 100 × "I love you" on an anniversary
- "Good morning beautiful ☀️" × 30, one for every day of the month
- "I'm sorry, I was wrong" × 50, when it really was your fault
- "Happy birthday!!" × however old they're turning

## Please be nice with it

Heartburst is made for one person who will smile when they see it. Don't use it on strangers, on people who have asked you to stop, or to flood anyone's inbox. That's not cute, and TikTok will probably restrict your account for it.

That's why it has built-in limits: **at most 100 messages per run** and **at least 1 second between messages**. A slower pace also feels nicer on the other end. Their phone buzzes over and over instead of getting one giant dump.

## Permissions

| Permission | Why it's needed |
| --- | --- |
| `storage` | Remember your message, count and emoji list |
| `activeTab`, `scripting` | Type into the TikTok tab you're using |
| `tiktok.com` | It only runs on TikTok and nowhere else |

It makes no network requests of its own, does no tracking and collects no data. Everything happens in your browser.

## Known issues

- TikTok changes its website now and then. If messages stop being typed or sent, reload the page first. If it's still broken, open an issue. The selectors in `findEditor()` and `findSendButton()` in `content.js` are usually what needs updating.
- It only works on the TikTok website, not in the phone app.

## License

[MIT](LICENSE)
