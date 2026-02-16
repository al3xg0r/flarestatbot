import asyncio
import os
import logging
from aiogram import Bot, Dispatcher, F, types
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.utils.keyboard import InlineKeyboardBuilder
from dotenv import load_dotenv
from cf_api import CloudflareManager

# Настройка
load_dotenv()
logging.basicConfig(level=logging.INFO)
bot = Bot(token=os.getenv("BOT_TOKEN"))
dp = Dispatcher(storage=MemoryStorage())
ADMIN_ID = int(os.getenv("ADMIN_ID"))

# Состояния FSM
class Form(StatesGroup):
    waiting_for_new_ip = State()
    waiting_for_add_name = State()
    waiting_for_add_ip = State()

# --- Вспомогательные функции ---

# Клавиатура со списком доменов (зон)
async def get_zones_keyboard():
    zones = await CloudflareManager.get_zones()
    builder = InlineKeyboardBuilder()
    if not zones:
        return None
    
    for zone in zones:
        # callback: zone_{zone_id}
        builder.button(text=f"🌐 {zone['name']}", callback_data=f"selzone_{zone['id']}")
    
    builder.button(text="🔄 Обновить список", callback_data="refresh_zones")
    builder.adjust(1)
    return builder.as_markup()

# Клавиатура меню конкретной зоны
def get_zone_menu_keyboard(zone_id):
    builder = InlineKeyboardBuilder()
    builder.button(text="📋 DNS Записи", callback_data=f"listdns_{zone_id}")
    builder.button(text="➕ Добавить запись", callback_data=f"adddns_{zone_id}")
    builder.button(text="🔙 К списку доменов", callback_data="refresh_zones")
    builder.adjust(1)
    return builder.as_markup()

# Клавиатура управления записью
def get_record_keyboard(zone_id, record_id, proxied):
    builder = InlineKeyboardBuilder()
    proxy_status = "🟢 ON" if proxied else "🔴 OFF"
    # Передаем zone_id везде, чтобы знать контекст
    builder.button(text=f"Proxy: {proxy_status}", callback_data=f"proxy_{zone_id}_{record_id}")
    builder.button(text="✏️ Сменить IP", callback_data=f"editip_{zone_id}_{record_id}")
    builder.button(text="❌ Удалить", callback_data=f"del_{zone_id}_{record_id}")
    builder.button(text="🔙 Назад к записям", callback_data=f"listdns_{zone_id}")
    builder.adjust(1)
    return builder.as_markup()

# --- Хендлеры ---

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    kb = await get_zones_keyboard()
    if kb:
        await message.answer("Выберите домен для управления:", reply_markup=kb)
    else:
        await message.answer("Не удалось получить список зон. Проверьте токен (права Zone:Read).")

@dp.callback_query(F.data == "refresh_zones")
async def refresh_zones_handler(callback: types.CallbackQuery):
    kb = await get_zones_keyboard()
    if kb:
        await callback.message.edit_text("Выберите домен для управления:", reply_markup=kb)
    else:
        await callback.answer("Ошибка получения зон", show_alert=True)

# Выбор зоны -> Меню зоны
@dp.callback_query(F.data.startswith("selzone_"))
async def select_zone_handler(callback: types.CallbackQuery):
    zone_id = callback.data.split("_")[1]
    await callback.message.edit_text(f"Управление зоной:", reply_markup=get_zone_menu_keyboard(zone_id))

# Список DNS записей в зоне
@dp.callback_query(F.data.startswith("listdns_"))
async def list_dns_handler(callback: types.CallbackQuery):
    zone_id = callback.data.split("_")[1]
    records = await CloudflareManager.get_dns_records(zone_id)
    
    builder = InlineKeyboardBuilder()
    count = 0
    for rec in records:
        if rec['type'] in ['A', 'CNAME']:
            status = "☁️" if rec['proxied'] else "🌪"
            # view_{zone_id}_{record_id}
            builder.button(text=f"{status} {rec['name']} ({rec['content']})", callback_data=f"view_{zone_id}_{rec['id']}")
            count += 1
    
    builder.button(text="🔙 Назад", callback_data=f"selzone_{zone_id}")
    builder.adjust(1)
    
    msg_text = f"Найдено записей (A/CNAME): {count}"
    await callback.message.edit_text(msg_text, reply_markup=builder.as_markup())

# Просмотр конкретной записи
@dp.callback_query(F.data.startswith("view_"))
async def view_record_handler(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    zone_id = parts[1]
    rec_id = parts[2]
    
    records = await CloudflareManager.get_dns_records(zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if not record:
        await callback.answer("Запись не найдена", show_alert=True)
        await list_dns_handler(callback) # Вернуть в список
        return

    info = (
        f"<b>Zone ID:</b> {zone_id}\n"
        f"<b>Name:</b> {record['name']}\n"
        f"<b>Type:</b> {record['type']}\n"
        f"<b>Content:</b> {record['content']}\n"
        f"<b>Proxied:</b> {'Да' if record['proxied'] else 'Нет'}"
    )
    await callback.message.edit_text(info, reply_markup=get_record_keyboard(zone_id, rec_id, record['proxied']))

# Вкл/Выкл Proxy
@dp.callback_query(F.data.startswith("proxy_"))
async def toggle_proxy_handler(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    zone_id = parts[1]
    rec_id = parts[2]
    
    records = await CloudflareManager.get_dns_records(zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if record:
        res = await CloudflareManager.toggle_proxy(zone_id, rec_id, record['proxied'], record)
        if res.get("success"):
            new_proxied = not record['proxied']
            # Обновляем текст и клавиатуру
            info = (
                f"<b>Name:</b> {record['name']}\n"
                f"<b>Content:</b> {record['content']}\n"
                f"<b>Proxied:</b> {'Да' if new_proxied else 'Нет'}"
            )
            await callback.message.edit_text(info, reply_markup=get_record_keyboard(zone_id, rec_id, new_proxied))
        else:
            await callback.answer(f"Ошибка CF: {res}", show_alert=True)

# Смена IP (Начало)
@dp.callback_query(F.data.startswith("editip_"))
async def edit_ip_start(callback: types.CallbackQuery, state: FSMContext):
    parts = callback.data.split("_")
    zone_id = parts[1]
    rec_id = parts[2]
    
    await state.update_data(zone_id=zone_id, rec_id=rec_id)
    await callback.message.answer("Введите новый IP адрес:")
    await state.set_state(Form.waiting_for_new_ip)
    await callback.answer()

# Смена IP (Финиш)
@dp.message(Form.waiting_for_new_ip)
async def edit_ip_finish(message: types.Message, state: FSMContext):
    data = await state.get_data()
    zone_id = data['zone_id']
    rec_id = data['rec_id']
    new_ip = message.text.strip()
    
    # Получаем старую запись для метаданных
    records = await CloudflareManager.get_dns_records(zone_id)
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if record:
        res = await CloudflareManager.change_ip(zone_id, rec_id, new_ip, record)
        if res.get("success"):
            await message.answer(f"✅ IP изменен на {new_ip}")
        else:
            await message.answer(f"❌ Ошибка API: {res.get('errors')}")
    
    await state.clear()
    # Возвращаем меню зоны
    await message.answer("Меню зоны:", reply_markup=get_zone_menu_keyboard(zone_id))

# Удаление записи
@dp.callback_query(F.data.startswith("del_"))
async def delete_record_handler(callback: types.CallbackQuery):
    parts = callback.data.split("_")
    zone_id = parts[1]
    rec_id = parts[2]
    
    res = await CloudflareManager.delete_record(zone_id, rec_id)
    if res.get("success"):
        await callback.answer("Запись удалена")
        # Хитрость: модифицируем callback.data, чтобы вызвать list_dns_handler
        callback.data = f"listdns_{zone_id}"
        await list_dns_handler(callback)
    else:
        await callback.answer("Ошибка удаления", show_alert=True)

# Добавление записи (Начало)
@dp.callback_query(F.data.startswith("adddns_"))
async def add_dns_start(callback: types.CallbackQuery, state: FSMContext):
    zone_id = callback.data.split("_")[1]
    await state.update_data(zone_id=zone_id)
    
    await callback.message.answer("Введите имя поддомена (например: app или @ для корня):")
    await state.set_state(Form.waiting_for_add_name)
    await callback.answer()

@dp.message(Form.waiting_for_add_name)
async def add_dns_name(message: types.Message, state: FSMContext):
    await state.update_data(name=message.text.strip())
    await message.answer("Введите IP адрес:")
    await state.set_state(Form.waiting_for_add_ip)

@dp.message(Form.waiting_for_add_ip)
async def add_dns_ip(message: types.Message, state: FSMContext):
    data = await state.get_data()
    zone_id = data['zone_id']
    name = data['name']
    ip = message.text.strip()
    
    res = await CloudflareManager.add_record(zone_id, name, ip)
    if res.get("success"):
        await message.answer(f"✅ Запись {name} -> {ip} добавлена!")
    else:
        await message.answer(f"❌ Ошибка: {res.get('errors')}")
    
    await state.clear()
    await message.answer("Меню зоны:", reply_markup=get_zone_menu_keyboard(zone_id))

async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())