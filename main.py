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
from aiogram.enums import ParseMode
from dotenv import load_dotenv
from cf_api import CloudflareManager
import db
from locales import t  # Импортируем переводчик

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
    in_zone_menu = State()

# --- Вспомогательные функции ---

async def get_user_token(user_id, lang, message: types.Message = None):
    token = db.get_token(user_id)
    if not token and message:
        # Для неавторизованных используем переданный язык
        await message.answer(t("start_auth", lang), parse_mode=ParseMode.HTML, link_preview_options=LinkPreviewOptions(is_disabled=True))
    return token

async def get_zones_keyboard(token, lang):
    zones = await CloudflareManager.get_zones(token)
    builder = InlineKeyboardBuilder()
    
    if zones is not None: 
        if not zones:
            builder.button(text=t("zones_empty", lang), callback_data="refresh_zones")
        else:
            for zone in zones:
                builder.button(text=f"🌐 {zone['name']}", callback_data=f"selzone_{zone['id']}")
            builder.button(text=t("btn_refresh", lang), callback_data="refresh_zones")
    else:
        return None
    
    builder.button(text=t("btn_logout", lang), callback_data="logout")
    builder.adjust(1)
    return builder.as_markup()

def get_zone_menu_keyboard(lang):
    builder = InlineKeyboardBuilder()
    builder.button(text=t("btn_dns_list", lang), callback_data="listdns")
    builder.button(text=t("btn_add", lang), callback_data="adddns_start")
    builder.button(text=t("btn_back_zones", lang), callback_data="refresh_zones")
    builder.adjust(1)
    return builder.as_markup()

def get_record_keyboard(record_id, proxied, lang):
    builder = InlineKeyboardBuilder()
    proxy_status = "🟢 ON" if proxied else "🔴 OFF"
    builder.button(text=f"Proxy: {proxy_status}", callback_data=f"proxy_{record_id}")
    builder.button(text=t("btn_edit_ip", lang), callback_data=f"editip_{record_id}")
    builder.button(text=t("btn_delete", lang), callback_data=f"del_{record_id}")
    builder.button(text=t("btn_back_list", lang), callback_data="listdns")
    builder.adjust(1)
    return builder.as_markup()

# --- Хендлеры Авторизации ---

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    await state.clear()
    lang = message.from_user.language_code
    token = db.get_token(message.from_user.id)
    
    if token:
        kb = await get_zones_keyboard(token, lang)
        if kb:
            await message.answer(t("welcome_back", lang, name=message.from_user.first_name), reply_markup=kb)
        else:
             await message.answer(t("token_outdated", lang))
             await state.set_state(Form.waiting_for_token)
    else:
        await message.answer(
            t("start_auth", lang), 
            parse_mode=ParseMode.HTML,
            link_preview_options=LinkPreviewOptions(is_disabled=True)
        )
        await state.set_state(Form.waiting_for_token)

@dp.message(Form.waiting_for_token)
async def process_token(message: types.Message, state: FSMContext):
    lang = message.from_user.language_code
    token = message.text.strip()
    msg = await message.answer(t("token_checking", lang))
    is_valid = await CloudflareManager.validate_token(token)
    
    if is_valid:
        db.add_user(message.from_user.id, token)
        await msg.edit_text(t("token_success", lang))
        kb = await get_zones_keyboard(token, lang)
        await message.answer(t("welcome_back", lang, name=message.from_user.first_name), reply_markup=kb)
        await state.clear()
    else:
        await msg.edit_text(t("token_invalid", lang), parse_mode=ParseMode.HTML)

@dp.callback_query(F.data == "logout")
async def logout_handler(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.from_user.language_code
    db.delete_user(callback.from_user.id)
    await state.clear()
    await callback.message.edit_text(t("logout_msg", lang), reply_markup=None)
    await state.set_state(Form.waiting_for_token)

# --- Хендлеры Управления ---

@dp.callback_query(F.data == "refresh_zones")
async def refresh_zones_handler(callback: types.CallbackQuery, state: FSMContext):
    await state.clear()
    lang = callback.from_user.language_code
    token = await get_user_token(callback.from_user.id, lang)
    if not token: return await logout_handler(callback, state)

    kb = await get_zones_keyboard(token, lang)
    if kb:
        await callback.message.edit_text(t("welcome_back", lang, name=callback.from_user.first_name), reply_markup=kb)
    else:
        await callback.answer(t("error_zones", lang), show_alert=True)

@dp.callback_query(F.data.startswith("selzone_"))
async def select_zone_handler(callback: types.CallbackQuery, state: FSMContext):
    zone_id = callback.data.split("_")[1]
    lang = callback.from_user.language_code
    await state.update_data(current_zone_id=zone_id)
    await callback.message.edit_text(t("zone_menu_title", lang), reply_markup=get_zone_menu_keyboard(lang))

@dp.callback_query(F.data == "listdns")
async def list_dns_handler(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.from_user.language_code
    token = await get_user_token(callback.from_user.id, lang)
    if not token: return

    data = await state.get_data()
    zone_id = data.get("current_zone_id")
    
    if not zone_id:
        await callback.answer(t("session_expired", lang), show_alert=True)
        await refresh_zones_handler(callback, state)
        return

    try:
        records = await CloudflareManager.get_dns_records(token, zone_id)
        builder = InlineKeyboardBuilder()
        
        filtered_records = [r for r in records if r['type'] in ['A', 'CNAME']]
        
        for rec in filtered_records[:30]:
            status = "☁️" if rec['proxied'] else "🌪"
            label = f"{status} {rec['name']} ({rec['content']})"
            if len(label) > 30: label = label[:27] + "..."
            builder.button(text=label, callback_data=f"view_{rec['id']}")
        
        builder.button(text=t("btn_back_menu", lang), callback_data=f"selzone_{zone_id}")
        builder.adjust(1)
        
        msg_text = t("records_found", lang, count=len(filtered_records))
        if len(filtered_records) > 30: msg_text += t("records_found_limit", lang)
        
        await callback.message.edit_text(msg_text, reply_markup=builder.as_markup())
        
    except Exception as e:
        logging.error(f"Error in list_dns: {e}")
        await callback.answer(t("error_generic", lang, error=e), show_alert=True)

@dp.callback_query(F.data.startswith("view_"))
async def view_record_handler(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.from_user.language_code
    token = await get_user_token(callback.from_user.id, lang)
    if not token: return

    rec_id = callback.data.split("_")[1]
    data = await state.get_data()
    zone_id = data.get("current_zone_id")

    if not zone_id:
        await callback.answer(t("session_expired", lang), show_alert=True)
        return

    records = await CloudflareManager.get_dns_records(token, zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if not record:
        await callback.answer(t("record_not_found", lang), show_alert=True)
        return

    info = (
        f"<b>Type:</b> {record['type']}\n"
        f"<b>Name:</b> {record['name']}\n"
        f"<b>Content:</b> {record['content']}\n"
        f"<b>Proxied:</b> {'Да' if record['proxied'] else 'Нет'}"
    )
    await callback.message.edit_text(info, reply_markup=get_record_keyboard(rec_id, record['proxied'], lang), parse_mode=ParseMode.HTML)

@dp.callback_query(F.data.startswith("proxy_"))
async def toggle_proxy_handler(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.from_user.language_code
    token = await get_user_token(callback.from_user.id, lang)
    if not token: return

    rec_id = callback.data.split("_")[1]
    data = await state.get_data()
    zone_id = data.get("current_zone_id")

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
            await callback.message.edit_text(info, reply_markup=get_record_keyboard(rec_id, new_proxied, lang), parse_mode=ParseMode.HTML)
        else:
            await callback.answer(t("error_generic", lang, error=res), show_alert=True)

@dp.callback_query(F.data.startswith("editip_"))
async def edit_ip_start(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.from_user.language_code
    rec_id = callback.data.split("_")[1]
    await state.update_data(editing_rec_id=rec_id)
    
    await callback.message.answer(t("enter_new_ip", lang))
    await state.set_state(Form.waiting_for_new_ip)
    await callback.answer()

@dp.message(Form.waiting_for_new_ip)
async def edit_ip_finish(message: types.Message, state: FSMContext):
    lang = message.from_user.language_code
    token = await get_user_token(message.from_user.id, lang, message)
    if not token: return

    data = await state.get_data()
    zone_id = data.get("current_zone_id")
    rec_id = data.get("editing_rec_id")
    new_ip = message.text.strip()
    
    records = await CloudflareManager.get_dns_records(token, zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if record:
        res = await CloudflareManager.change_ip(token, zone_id, rec_id, new_ip, record)
        if res.get("success"):
            await message.answer(t("ip_changed", lang, ip=new_ip))
        else:
            await message.answer(t("error_generic", lang, error=res.get('errors')))
    
    await state.set_state(None)
    await message.answer(t("zone_menu_title", lang), reply_markup=get_zone_menu_keyboard(lang))

@dp.callback_query(F.data == "adddns_start")
async def add_dns_start(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.from_user.language_code
    await callback.message.answer(t("enter_name", lang))
    await state.set_state(Form.waiting_for_add_name)
    await callback.answer()

@dp.message(Form.waiting_for_add_name)
async def add_dns_name(message: types.Message, state: FSMContext):
    lang = message.from_user.language_code
    await state.update_data(new_rec_name=message.text.strip())
    await message.answer(t("enter_new_ip", lang))
    await state.set_state(Form.waiting_for_add_ip)

@dp.message(Form.waiting_for_add_ip)
async def add_dns_ip(message: types.Message, state: FSMContext):
    lang = message.from_user.language_code
    token = await get_user_token(message.from_user.id, lang, message)
    if not token: return

    data = await state.get_data()
    zone_id = data.get("current_zone_id")
    name = data.get("new_rec_name")
    ip = message.text.strip()
    
    res = await CloudflareManager.add_record(token, zone_id, name, ip)
    
    if res.get("success"):
        await message.answer(t("record_added", lang))
    else:
        await message.answer(t("error_generic", lang, error=res.get('errors')))
    
    await state.set_state(None)
    await message.answer(t("zone_menu_title", lang), reply_markup=get_zone_menu_keyboard(lang))

@dp.callback_query(F.data.startswith("del_"))
async def delete_record_handler(callback: types.CallbackQuery, state: FSMContext):
    lang = callback.from_user.language_code
    token = await get_user_token(callback.from_user.id, lang)
    rec_id = callback.data.split("_")[1]
    data = await state.get_data()
    zone_id = data.get("current_zone_id")
    
    res = await CloudflareManager.delete_record(token, zone_id, rec_id)
    
    if res.get("success"):
        await callback.answer(t("deleted", lang))
        await list_dns_handler(callback, state)
    else:
        await callback.answer(t("error_generic", lang, error="Delete failed"), show_alert=True)

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())