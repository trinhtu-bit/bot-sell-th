require('dotenv').config();
const fs = require('fs-extra');
const express = require('express');
const fetch = require('node-fetch');
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  Events, 
  PermissionsBitField,
  ActivityType
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;
const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID || null;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || null;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null;
const KEY_API_URL = process.env.KEY_API_URL;
const KEY_API_SECRET = process.env.KEY_API_SECRET;

if (!TOKEN || !CLIENT_ID) {
  console.error('⚠️ Vui lòng cấu hình DISCORD_TOKEN và CLIENT_ID trong .env');
  process.exit(1);
}

const DATA_FILE = './data.json';
if (!fs.existsSync(DATA_FILE)) fs.writeJsonSync(DATA_FILE, { orders: [], keys: [] }, { spaces: 2 });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Danh sách activity ngẫu nhiên
const activities = [
  { name: "GTA VI", type: ActivityType.Playing },
  { name: "Spotify", type: ActivityType.Listening },
  { name: "Youtube", type: ActivityType.Watching },
  { name: "Code Discord Bot", type: ActivityType.Competing },
  { name: "Minecraft", type: ActivityType.Playing },
];

// Slash commands
const postPriceCommand = new SlashCommandBuilder()
  .setName('postprice')
  .setDescription('Đăng bài giới thiệu gói key (admin only)');

const addSupportCommand = new SlashCommandBuilder()
  .setName('addsupport')
  .setDescription('Thêm 1 người vào ticket để hỗ trợ')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('Người cần add vào ticket')
      .setRequired(true)
  );

const genKeyCommand = new SlashCommandBuilder()
  .setName('genkey')
  .setDescription('Tạo key mới từ API')
  .addIntegerOption(option =>
    option.setName('days')
      .setDescription('Số ngày của key')
      .setRequired(true)
  );

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('📥 Đang đăng slash command...');
    const cmds = [
      postPriceCommand.toJSON(), 
      addSupportCommand.toJSON(),
      genKeyCommand.toJSON()
    ];

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: cmds });
      console.log('✅ Đã đăng command vào guild DEV.');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: cmds });
      console.log('✅ Đã đăng command toàn cục.');
    }
  } catch (err) {
    console.error('❌ Lỗi khi đăng command:', err);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`🤖 Bot sẵn sàng: ${client.user.tag}`);

  // Cập nhật activity ngẫu nhiên
  setInterval(() => {
    const random = activities[Math.floor(Math.random() * activities.length)];
    client.user.setActivity(random);
  }, 15000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      // /postprice
      if (interaction.commandName === 'postprice') {
        const member = interaction.member;
        const isAdmin = member.permissions?.has(PermissionsBitField.Flags.ManageGuild) || member.user.id === interaction.guild.ownerId;
        if (!isAdmin) {
          await interaction.reply({ content: '❌ Bạn không có quyền dùng lệnh này.', ephemeral: true });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🔥 Bảng Giá Key Free Fire')
          .setDescription(
            'Giá key tham khảo cho Free Fire\n\n' +
            '💳 Thanh toán qua **Momo / MB Bank / TP Bank**\n\n' +
            '**Gói 1 Ngày** — 20.000 VND\n' +
            '**Gói 7 Ngày** — 80.000 VND\n' +
            '**Gói 30 Ngày** — 150.000 VND\n' +
            '**Vĩnh Viễn** — 500.000 VND\n\n' +
            '📝 *Giá có thể thay đổi tùy đợt khuyến mãi.*\n' +
            '📩 Liên hệ admin để được hỗ trợ nhanh nhất.'
          )
          .setColor(0xff5a5a)
          .setFooter({ text: `Yêu cầu bởi ${interaction.user.username}` })
          .setTimestamp();

        const btn1 = new ButtonBuilder().setCustomId('buy_1').setLabel('🛒 Mua Gói 1 Ngày').setStyle(ButtonStyle.Secondary);
        const btn7 = new ButtonBuilder().setCustomId('buy_7').setLabel('🛒 Mua Gói 7 Ngày').setStyle(ButtonStyle.Primary);
        const btn30 = new ButtonBuilder().setCustomId('buy_30').setLabel('🛒 Mua Gói 30 Ngày').setStyle(ButtonStyle.Success);
        const btnLife = new ButtonBuilder().setCustomId('buy_life').setLabel('🛒 Mua Vĩnh Viễn').setStyle(ButtonStyle.Danger);

        const row1 = new ActionRowBuilder().addComponents(btn1, btn7);
        const row2 = new ActionRowBuilder().addComponents(btn30, btnLife);

        await interaction.reply({ embeds: [embed], components: [row1, row2] });
      }

      // /addsupport
      if (interaction.commandName === 'addsupport') {
        const userToAdd = interaction.options.getUser('user');
        if (!interaction.channel.name.startsWith('donhang-')) {
          await interaction.reply({ content: '❌ Lệnh này chỉ dùng trong kênh đơn hàng.', ephemeral: true });
          return;
        }

        await interaction.channel.permissionOverwrites.edit(userToAdd.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });

        await interaction.reply({ content: `✅ Đã thêm ${userToAdd} vào đơn hàng để hỗ trợ.`, ephemeral: true });
      }

      // /genkey
      if (interaction.commandName === 'genkey') {
        const days = interaction.options.getInteger('days');
        try {
          const url = `${KEY_API_URL}?action=genkey&days=${days}&apikey=${KEY_API_SECRET}`;
          const res = await fetch(url);
          const text = await res.text(); // in case API trả plain text
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = { success: text.includes("KEY"), key: text };
          }

          if (data.success) {
            const embedKey = new EmbedBuilder()
              .setTitle("🔑 Key Mới Tạo Thành Công")
              .addFields(
                { name: "Key", value: `\`${data.key}\`` },
                { name: "Thời hạn", value: `${data.expire || days + " ngày"}` }
              )
              .setColor("Green")
              .setTimestamp();

            await interaction.reply({ embeds: [embedKey] });

            const db = fs.readJsonSync(DATA_FILE);
            db.keys.push({
              key: data.key,
              expire: data.expire || days + " ngày",
              createdAt: new Date().toISOString(),
              userId: interaction.user.id
            });
            fs.writeJsonSync(DATA_FILE, db, { spaces: 2 });

          } else {
            await interaction.reply({ content: `❌ API trả lỗi: ${data.message || text}` });
          }
        } catch (err) {
          console.error(err);
          await interaction.reply({ content: "❌ Lỗi khi gọi API tạo key." });
        }
      }

      return;
    }

    // Interaction: buttons
    if (interaction.isButton()) {
      const id = interaction.customId;

      // 🔒 Đóng đơn hàng
      if (id === 'close_donhang') {
        await interaction.reply({ content: '⏳ Đơn Hàng sẽ bị đóng sau 5 giây...', ephemeral: true });
        setTimeout(() => {
          interaction.channel.delete().catch(() => {});
        }, 5000);
        return;
      }

      // Mua hàng
      let packageName = '';
      let price = 0;
      if (id === 'buy_1') { packageName = 'Gói 1 Ngày'; price = 20000; }
      else if (id === 'buy_7') { packageName = 'Gói 7 Ngày'; price = 80000; }
      else if (id === 'buy_30') { packageName = 'Gói 30 Ngày'; price = 150000; }
      else if (id === 'buy_life') { packageName = 'Vĩnh Viễn'; price = 500000; }
      else {
        await interaction.reply({ content: '❌ Nút không hợp lệ.', ephemeral: true });
        return;
      }

      const order = {
        id: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId: interaction.user.id,
        username: `${interaction.user.username}#${interaction.user.discriminator}`,
        package: packageName,
        price,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const db = fs.readJsonSync(DATA_FILE);
      db.orders.push(order);
      fs.writeJsonSync(DATA_FILE, db, { spaces: 2 });

      const guild = interaction.guild;
      const category = guild.channels.cache.find(c => c.name === "MUA-HANG" && c.type === 4);

      const overwrites = [
        { id: guild.roles.everyone, deny: ['ViewChannel'] },
        { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
      ];

      if (ADMIN_ROLE_ID) {
        overwrites.push({
          id: ADMIN_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        });
      }

      if (SUPPORT_ROLE_ID) {
        overwrites.push({
          id: SUPPORT_ROLE_ID,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        });
      }

      const ticketChannel = await guild.channels.create({
        name: `donhang-${interaction.user.username}`,
        type: 0,
        parent: category ? category.id : null,
        topic: interaction.user.id,
        permissionOverwrites: overwrites
      });

      const embedOrder = new EmbedBuilder()
        .setTitle('🛒 Đơn Hàng Mới')
        .setDescription(
          `Xin chào <@${interaction.user.id}>,\n\n` +
          `Bạn đã chọn **${packageName}** — **${price.toLocaleString('vi-VN')} VND**.\n\n` +
          `💳 Vui lòng chuyển khoản theo thông tin và quét QR bên dưới:\n\n` +
          `📌 **MBBANK:** 0769100185 (TRINH VAN TU)\n` +
          `📌 **TPBank:** 0769100185 (TRINH VAN TU)\n\n` +
          `📩 Sau khi thanh toán, gửi ảnh hóa đơn tại đây.\n\n` +
          `Mã đơn hàng của bạn: **${order.id}**`
        )
        .setColor(0x00AE86)
        .setImage("https://media.discordapp.net/attachments/1381893033272021032/1381898955452977152/Picsart_25-01-26_21-26-09-963.png?ex=68cfaa31&is=68ce58b1&hm=8d5b99cf1ace0fd85e9faaa6e1fdc2bcb08629f9467a1e30eaffb7afacfee339&=&format=webp&quality=lossless")
        .setTimestamp();

      const closeBtn = new ButtonBuilder().setCustomId('close_donhang').setLabel('🔒 Đóng Đơn Hàng').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(closeBtn);

      await ticketChannel.send({ 
        content: `<@${interaction.user.id}> ${ADMIN_ROLE_ID ? `<@&${ADMIN_ROLE_ID}>` : ''} ${SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}>` : ''}`, 
        embeds: [embedOrder], 
        components: [row] 
      });

      await interaction.reply({ content: `✅ Đã tạo kênh riêng: ${ticketChannel}`, ephemeral: true });
    }
  } catch (err) {
    console.error('❌ Error in interaction handler:', err);
    if (interaction && !interaction.replied) {
      try { await interaction.reply({ content: 'Đã có lỗi xảy ra.', ephemeral: true }); } catch {}
    }
  }
});

// Start bot
(async () => {
  await registerCommands();
  client.login(TOKEN);
})();

// Fake server để Render Free không kill app
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(PORT, () => console.log(`🌐 Web server listening on port ${PORT}`));
