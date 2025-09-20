require('dotenv').config();
const fs = require('fs-extra');
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
  PermissionsBitField 
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || null;
const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID || null;

if (!TOKEN || !CLIENT_ID) {
  console.error('Vui lòng cấu hình DISCORD_TOKEN và CLIENT_ID trong .env');
  process.exit(1);
}

// Ensure data file exists
const DATA_FILE = './data.json';
if (!fs.existsSync(DATA_FILE)) fs.writeJsonSync(DATA_FILE, { orders: [] }, { spaces: 2 });

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

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

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Đang đăng slash command...');
    const cmds = [postPriceCommand.toJSON(), addSupportCommand.toJSON()];

    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: cmds });
      console.log('Đã đăng command vào guild DEV.');
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: cmds });
      console.log('Đã đăng command toàn cục.');
    }
  } catch (err) {
    console.error('Lỗi khi đăng command:', err);
  }
}

client.once(Events.ClientReady, () => {
  console.log(`Bot sẵn sàng: ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash command xử lý
    if (interaction.isChatInputCommand()) {
      // /postprice
      if (interaction.commandName === 'postprice') {
        const member = interaction.member;
        const isAdmin = member.permissions?.has(PermissionsBitField.Flags.ManageGuild) || member.user.id === interaction.guild.ownerId;
        if (!isAdmin) {
          await interaction.reply({ content: 'Bạn không có quyền dùng lệnh này.', ephemeral: true });
          return;
        }

        // Embed bảng giá
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
          .setImage('https://static.ybox.vn/2023/10/0/1696778460328-giphy.gif')
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

        // Check nếu là admin hoặc chủ đơn hàng
        const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
        const ticketOwnerId = interaction.channel.topic || null; // mình sẽ lưu ownerId trong topic

        if (!isAdmin && interaction.user.id !== ticketOwnerId) {
          await interaction.reply({ content: '❌ Bạn không có quyền add người vào đơn hàng này.', ephemeral: true });
          return;
        }

        await interaction.channel.permissionOverwrites.edit(userToAdd.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });

        await interaction.reply({ content: `✅ Đã thêm ${userToAdd} vào đơn hàng để hỗ trợ.`, ephemeral: true });
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
      else if (id === 'buy_7') { packageName = 'Gói 7 Ngày'; price = 50000; }
      else if (id === 'buy_30') { packageName = 'Gói 30 Ngày'; price = 150000; }
      else if (id === 'buy_life') { packageName = 'Vĩnh Viễn'; price = 500000; }
      else {
        await interaction.reply({ content: 'Nút không hợp lệ.', ephemeral: true });
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

      // Tạo channel đơn hàng
      const guild = interaction.guild;
      const category = guild.channels.cache.find(c => c.name === "MUA-HANG" && c.type === 4);

      const ticketChannel = await guild.channels.create({
        name: `donhang-${interaction.user.username}`,
        type: 0,
        parent: category ? category.id : null,
        topic: interaction.user.id, // lưu userId chủ đơn hàng
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: ['ViewChannel'] },
          { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
          { id: guild.roles.cache.find(r => r.permissions.has(PermissionsBitField.Flags.Administrator)).id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
        ]
      });

      const embedOrder = new EmbedBuilder()
        .setTitle('🛒 Đơn Hàng Mới')
        .setDescription(
          `Xin chào <@${interaction.user.id}>,\n\n` +
          `Bạn đã chọn **${packageName}** — **${price.toLocaleString('vi-VN')} VND**.\n\n` +
          `💳 Vui lòng chuyển khoản tới:\n` +
          `**MBBANK:** 0769100185 (Tên: TRINH VAN TU)\n` +
          `Hoặc **TPBank:** 0769100185 - Tên: TRINH VAN TU\n\n` +
          `📩 Sau khi chuyển khoản, gửi ảnh hóa đơn tại đây.\n\n` +
          `Mã đơn hàng của bạn: **${order.id}**`
        )
        .setColor(0x00AE86)
        .setTimestamp();

      const closeBtn = new ButtonBuilder().setCustomId('close_donhang').setLabel('🔒 Đóng Đơn Hàng').setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(closeBtn);

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [embedOrder], components: [row] });

      await interaction.reply({ content: `✅ Đã tạo kênh riêng: ${ticketChannel}`, ephemeral: true });

      // Báo admin
      if (ADMIN_CHANNEL_ID) {
        const adminCh = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(()=>null);
        if (adminCh && adminCh.isTextBased()) {
          const adminEmbed = new EmbedBuilder()
            .setTitle('📥 MỚI: Yêu cầu mua key')
            .addFields(
              { name: 'User', value: `<@${order.userId}> (${order.username})`, inline: false },
              { name: 'Gói', value: `${order.package} — ${order.price.toLocaleString('vi-VN')} VND`, inline: true },
              { name: 'Mã', value: order.id, inline: true },
              { name: 'Thời gian', value: order.createdAt, inline: false }
            )
            .setColor(0x00AE86);

          adminCh.send({ embeds: [adminEmbed] }).catch(console.error);
        }
      }
    }
  } catch (err) {
    console.error('Error in interaction handler:', err);
    if (interaction && !interaction.replied) {
      try { await interaction.reply({ content: 'Đã có lỗi xảy ra.', ephemeral: true }); } catch {}
    }
  }
});

// Start
(async () => {
  await registerCommands();
  client.login(TOKEN);
})();
