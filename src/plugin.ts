import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { BetterStopwatch } from "./actions/stopwatch";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the BetterStopwatch action.
streamDeck.actions.registerAction(new BetterStopwatch());

// Finally, connect to the Stream Deck.
streamDeck.connect();
