import { Bot, Context, session } from "grammy";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import config, { configEndpoint } from "./config";

import connectDB from "./config/db";

import { common, root, wallet, trade, settings } from "./controllers";
import { init } from "./controllers/init";

type CusContext = Context & ConversationFlavor;

const bot = new Bot<CusContext>(config.TG_BOT_TOKEN);

(async function () {
  try {
    await connectDB();
    await configEndpoint();

    bot.use(
      session({
        initial() {
          return {};
        },
      })
    );

    bot.use(conversations());

    await init(bot);

    bot.command("start", root.start);
    bot.command("help", root.help);

    bot.callbackQuery("cancel", common.cancel);
    // wallet callback
    bot.callbackQuery("wallet", wallet.start);
    bot.callbackQuery("wallet_reset", wallet.reset);
    bot.callbackQuery("wallet_reset_confirm", wallet.resetConfirm);
    bot.callbackQuery("wallet_export", wallet.exportPrvkey);
    bot.callbackQuery("wallet_export_confirm", wallet.exportPrvkeyConfirm);
    bot.use(
      createConversation(
        wallet.transferConversation,
        "wallet-transfer-conversation"
      )
    );
    bot.callbackQuery("wallet_transfer", wallet.transfer);

    // // buy callback
    bot.use(createConversation(trade.buyConversation, "buy-conversation"));
    bot.callbackQuery("buy", trade.buy);
    bot.use(createConversation(trade.sellConversation, "sell-conversation"));
    bot.callbackQuery("sell", trade.sell);
    bot.callbackQuery("auto-sell", trade.autoSell);
    bot.callbackQuery("auto_sell_active", trade.autoSellActive);
    bot.use(
      createConversation(
        trade.autoSellHeightConversation,
        "auto-sell-height-conversation"
      )
    );
    bot.callbackQuery("auto_sell_height", trade.autoSellHeight);
    bot.use(
      createConversation(
        trade.autoSellTimeConversation,
        "auto-sell-time-conversation"
      )
    );
    bot.callbackQuery("auto_sell_time", trade.autoSellTime);
    bot.use(
      createConversation(
        trade.minPulledActiveConversation,
        "min-pulled-active-conversation"
      )
    );
    bot.callbackQuery("min-pulled", trade.minPulled);
    bot.callbackQuery("min-pulled-active", trade.minPulledActive);

    // settings callback
    {
      bot.callbackQuery("settings", settings.start);
      bot.callbackQuery("auto_buy_active", settings.autoBuyActive);
      bot.use(
        createConversation(
          settings.autoBuyAmountConversation,
          "autobuy-amount-conversation"
        )
      );
      bot.callbackQuery("auto_buy_amount", settings.autoBuyAmount);
      bot.use(
        createConversation(
          settings.autoBuySlippageConversation,
          "autobuy-slippage-conversation"
        )
      );
      bot.callbackQuery("auto_buy_slippage", settings.autoBuySlippage);
    }

    bot.on("message", trade.autoBuy);

    bot.catch((err) => console.log(err));

    bot.start();
  } catch (err) {
    console.log(err);
  }
})();
