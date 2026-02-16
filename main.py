import asyncio
import os
import logging
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.types import LinkPreviewOptions
from aiogram.enums import ParseMode  # ВАЖНО: Импорт для HTML
from dotenv import load_dotenv
from cf_api import CloudflareManager
import db

# Настройка
load_dotenv()
logging.basicConfig(level=logging.INFO)
bot = Bot(token=os.getenv("BOT_TOKEN"))
dp = Dispatcher(storage=MemoryStorage())

# Инициализация БД
db.init_db()

# Состояния FSM
class Form(StatesGroup):
    waiting_for_token = State()
    waiting_for_new_ip = State()
    waiting_for_add_name = State()
    waiting_for_add_ip = State()

# --- Вспомогательные функции ---

async def get_user_token(user_id, message: types.Message = None):
    token = db.get_token(user_id)
    if not token and message:
        await message.answer("🔑 Вы не авторизованы. Введите ваш API Token Cloudflare:")
    return token

async def get_zones_keyboard(token):
    zones = await CloudflareManager.get_zones(token)
    builder = InlineKeyboardBuilder()
    
    if zones is not None: 
        if not zones:
            builder.button(text="🔄 Обновить (Зон не найдено)", callback_data="refresh_zones")
        else:
            for zone in zones:
                builder.button(text=f"🌐 {zone['name']}", callback_data=f"selzone_{zone['id']}")
            builder.button(text="🔄 Обновить", callback_data="refresh_zones")
    else:
        return None
    
    builder.button(text="🚪 Выйти", callback_data="logout")
    builder.adjust(1)
    return builder.as_markup()

def get_zone_menu_keyboard(zone_id):
    builder = InlineKeyboardBuilder()
    builder.button(text="📋 DNS Записи", callback_data=f"listdns_{zone_id}")
    builder.button(text="➕ Добавить запись", callback_data=f"adddns_{zone_id}")
    builder.button(text="🔙 К списку доменов", callback_data="refresh_zones")
    builder.adjust(1)
    return builder.as_markup()

def get_record_keyboard(zone_id, record_id, proxied):
    builder = InlineKeyboardBuilder()
    proxy_status = "🟢 ON" if proxied else "🔴 OFF"
    builder.button(text=f"Proxy: {proxy_status}", callback_data=f"proxy_{zone_id}_{record_id}")
    builder.button(text="✏️ Сменить IP", callback_data=f"editip_{zone_id}_{record_id}")
    builder.button(text="❌ Удалить", callback_data=f"del_{zone_id}_{record_id}")
    builder.button(text="🔙 Назад к записям", callback_data=f"listdns_{zone_id}")
    builder.adjust(1)
    return builder.as_markup()

# --- Хендлеры Авторизации ---

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    token = db.get_token(message.from_user.id)
    if token:
        kb = await get_zones_keyboard(token)
        if kb:
            await message.answer(f"Привет, {message.from_user.first_name}! Ваши домены:", reply_markup=kb)
        else:
             await message.answer("Ваш сохраненный токен устарел. Введите новый:")
             await state.set_state(Form.waiting_for_token)
    else:
        text = (
            "👋 Привет! Это <b>Cloudflare Manager</b>.\n\n"
            "Для работы мне нужен ваш <b>API Token</b>.\n"
            "Создайте его здесь: https://dash.cloudflare.com/profile/api-tokens\n"
            "Шаблон: <b>Edit Zone DNS</b>\n\n"
            "Отправьте токен сообщением:"
        )
        # Включаем HTML и отключаем превью
        await message.answer(
            text, 
            parse_mode=ParseMode.HTML,
            link_preview_options=LinkPreviewOptions(is_disabled=True)
        )
        await state.set_state(Form.waiting_for_token)

@dp.message(Form.waiting_for_token)
async def process_token(message: types.Message, state: FSMContext):
    token = message.text.strip()
    
    msg = await message.answer("⏳ Проверяю токен...")
    is_valid = await CloudflareManager.validate_token(token)
    
    if is_valid:
        db.add_user(message.from_user.id, token)
        await msg.edit_text("✅ Токен принят! Загружаю зоны...")
        kb = await get_zones_keyboard(token)
        await message.answer("Ваши домены:", reply_markup=kb)
        await state.clear()
    else:
        await msg.edit_text(
            "❌ Токен невалиден.\n"
            "Убедитесь, что использовали шаблон <b>Edit Zone DNS</b>.\n"
            "Попробуйте еще раз:",
            parse_mode=ParseMode.HTML
        )

@dp.callback_query(F.data == "logout")
async def logout_handler(callback: types.CallbackQuery, state: FSMContext):
    db.delete_user(callback.from_user.id)
    await state.clear()
    await callback.message.edit_text(
        "Вы вышли из системы. Введите новый токен для входа:",
        reply_markup=None
    )
    await state.set_state(Form.waiting_for_token)

# --- Хендлеры Управления ---

@dp.callback_query(F.data == "refresh_zones")
async def refresh_zones_handler(callback: types.CallbackQuery):
    token = await get_user_token(callback.from_user.id)
    if not token:
        return await logout_handler(callback, None)

    kb = await get_zones_keyboard(token)
    if kb:
        await callback.message.edit_text("Ваши домены:", reply_markup=kb)
    else:
        await callback.answer("Ошибка получения зон", show_alert=True)

@dp.callback_query(F.data.startswith("selzone_"))
async def select_zone_handler(callback: types.CallbackQuery):
    zone_id = callback.data.split("_")[1]
    await callback.message.edit_text(f"Управление зоной:", reply_markup=get_zone_menu_keyboard(zone_id))

@dp.callback_query(F.data.startswith("listdns_"))
async def list_dns_handler(callback: types.CallbackQuery):
    token = await get_user_token(callback.from_user.id)
    if not token: return

    try:
        zone_id = callback.data.split("_")[1]
        records = await CloudflareManager.get_dns_records(token, zone_id)
        
        builder = InlineKeyboardBuilder()
        count = 0
        
        # Фильтруем и ограничиваем (макс 30 кнопок, чтобы не вылететь)
        filtered_records = [r for r in records if r['type'] in ['A', 'CNAME']]
        
        for rec in filtered_records[:30]:
            status = "☁️" if rec['proxied'] else "🌪"
            label = f"{status} {rec['name']} ({rec['content']})"
            # Обрезаем слишком длинные надписи для кнопок
            if len(label) > 30: 
                label = label[:27] + "..."
            builder.button(text=label, callback_data=f"view_{zone_id}_{rec['id']}")
            count += 1
        
        builder.button(text="🔙 Назад", callback_data=f"selzone_{zone_id}")
        builder.adjust(1)
        
        msg_text = f"Найдено записей (A/CNAME): {len(filtered_records)}"
        if len(filtered_records) > 30:
            msg_text += "\n(Показаны первые 30)"
        
        await callback.message.edit_text(msg_text, reply_markup=builder.as_markup())
    except Exception as e:
        logging.error(f"Error in list_dns: {e}")
        await callback.answer(f"Ошибка при загрузке: {e}", show_alert=True)

@dp.callback_query(F.data.startswith("view_"))
async def view_record_handler(callback: types.CallbackQuery):
    token = await get_user_token(callback.from_user.id)
    if not token: return

    parts = callback.data.split("_")
    zone_id, rec_id = parts[1], parts[2]
    
    records = await CloudflareManager.get_dns_records(token, zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if not record:
        await callback.answer("Запись не найдена", show_alert=True)
        return

    info = (
        f"<b>Type:</b> {record['type']}\n"
        f"<b>Name:</b> {record['name']}\n"
        f"<b>Content:</b> {record['content']}\n"
        f"<b>Proxied:</b> {'Да' if record['proxied'] else 'Нет'}"
    )
    await callback.message.edit_text(info, reply_markup=get_record_keyboard(zone_id, rec_id, record['proxied']), parse_mode=ParseMode.HTML)

@dp.callback_query(F.data.startswith("proxy_"))
async def toggle_proxy_handler(callback: types.CallbackQuery):
    token = await get_user_token(callback.from_user.id)
    if not token: return

    parts = callback.data.split("_")
    zone_id, rec_id = parts[1], parts[2]
    
    records = await CloudflareManager.get_dns_records(token, zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if record:
        res = await CloudflareManager.toggle_proxy(token, zone_id, rec_id, record['proxied'], record)
        if res.get("success"):
            new_proxied = not record['proxied']
            info = (
                f"<b>Type:</b> {record['type']}\n"
                f"<b>Name:</b> {record['name']}\n"
                f"<b>Content:</b> {record['content']}\n"
                f"<b>Proxied:</b> {'Да' if new_proxied else 'Нет'}"
            )
            await callback.message.edit_text(info, reply_markup=get_record_keyboard(zone_id, rec_id, new_proxied), parse_mode=ParseMode.HTML)
        else:
            await callback.answer(f"Ошибка CF: {res}", show_alert=True)

@dp.callback_query(F.data.startswith("editip_"))
async def edit_ip_start(callback: types.CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    await state.update_data(zone_id=parts[1], rec_id=parts[2])
    await callback.message.answer("Введите новый IP адрес:")
    await state.set_state(Form.waiting_for_new_ip)
    await callback.answer()

@dp.message(Form.waiting_for_new_ip)
async def edit_ip_finish(message: types.Message, state: FSMContext):
    token = await get_user_token(message.from_user.id, message)
    if not token: return

    data = await state.get_data()
    zone_id, rec_id = data['zone_id'], data['rec_id']
    new_ip = message.text.strip()
    
    records = await CloudflareManager.get_dns_records(token, zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if record:
        res = await CloudflareManager.change_ip(token, zone_id, rec_id, new_ip, record)
        if res.get("success"):
            await message.answer(f"✅ IP изменен на {new_ip}")
        else:
            await message.answer(f"❌ Ошибка: {res.get('errors')}")
    
    await state.clear()
    await message.answer("Меню зоны:", reply_markup=get_zone_menu_keyboard(zone_id))

@dp.callback_query(F.data.startswith("adddns_"))
async def add_dns_start(callback: types.CallbackQuery, state: FSMContext):
    zone_id = callback.data.split("_")[1]
    await state.update_data(zone_id=zone_id)
    await callback.message.answer("Введите имя (например: app):")
    await state.set_state(Form.waiting_for_add_name)
    await callback.answer()

@dp.message(Form.waiting_for_add_name)
async def add_dns_name(message: types.Message, state: FSMContext):
    await state.update_data(name=message.text.strip())
    await message.answer("Введите IP адрес:")
    await state.set_state(Form.waiting_for_add_ip)

@dp.message(Form.waiting_for_add_ip)
async def add_dns_ip(message: types.Message, state: FSMContext):
    token = await get_user_token(message.from_user.id, message)
    if not token: return

    data = await state.get_data()
    res = await CloudflareManager.add_record(token, data['zone_id'], data['name'], message.text.strip())
    
    if res.get("success"):
        await message.answer(f"✅ Запись добавлена!")
    else:
        await message.answer(f"❌ Ошибка: {res.get('errors')}")
    
    await state.clear()
    await message.answer("Меню зоны:", reply_markup=get_zone_menu_keyboard(data['zone_id']))

@dp.callback_query(F.data.startswith("del_"))
async def delete_record_handler(callback: types.CallbackQuery):
    token = await get_user_token(callback.from_user.id)
    parts = callback.data.split("_")
    res = await CloudflareManager.delete_record(token, parts[1], parts[2])
    
    if res.get("success"):
        await callback.answer("Удалено")
        callback.data = f"listdns_{parts[1]}"
        await list_dns_handler(callback)
    else:
        await callback.answer("Ошибка удаления", show_alert=True)

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())