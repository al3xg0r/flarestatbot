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

# --- Клавиатуры ---
def get_main_keyboard():
    builder = InlineKeyboardBuilder()
    builder.button(text="📋 Список DNS", callback_data="list_dns")
    builder.button(text="➕ Добавить запись", callback_data="add_dns_start")
    return builder.as_markup()

def get_record_keyboard(record_id, proxied):
    builder = InlineKeyboardBuilder()
    proxy_status = "🟢 ON" if proxied else "🔴 OFF"
    builder.button(text=f"Proxy: {proxy_status}", callback_data=f"proxy_{record_id}")
    builder.button(text="✏️ Сменить IP", callback_data=f"editip_{record_id}")
    builder.button(text="❌ Удалить", callback_data=f"del_{record_id}")
    builder.button(text="🔙 Назад", callback_data="list_dns")
    builder.adjust(1)
    return builder.as_markup()

# --- Хендлеры ---

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    if message.from_user.id != ADMIN_ID:
        return
    await message.answer("FlareStatBot готов к работе.", reply_markup=get_main_keyboard())

@dp.callback_query(F.data == "list_dns")
async def show_dns_list(callback: types.CallbackQuery):
    records = await CloudflareManager.get_dns_records()
    builder = InlineKeyboardBuilder()
    
    text = "<b>DNS Записи:</b>\n"
    for rec in records:
        # Показываем только A и CNAME для чистоты, можно убрать условие
        if rec['type'] in ['A', 'CNAME']:
            status = "☁️" if rec['proxied'] else "🌪"
            builder.button(text=f"{status} {rec['name']} ({rec['content']})", callback_data=f"view_{rec['id']}")
    
    builder.button(text="🔄 Обновить", callback_data="list_dns")
    builder.adjust(1)
    
    await callback.message.edit_text("Выберите запись для управления:", reply_markup=builder.as_markup())

@dp.callback_query(F.data.startswith("view_"))
async def view_record(callback: types.CallbackQuery):
    rec_id = callback.data.split("_")[1]
    records = await CloudflareManager.get_dns_records()
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if not record:
        await callback.answer("Запись не найдена", show_alert=True)
        return

    info = (
        f"<b>ID:</b> {record['id']}\n"
        f"<b>Name:</b> {record['name']}\n"
        f"<b>Type:</b> {record['type']}\n"
        f"<b>Content:</b> {record['content']}\n"
        f"<b>Proxied:</b> {'Да' if record['proxied'] else 'Нет'}"
    )
    await callback.message.edit_text(info, reply_markup=get_record_keyboard(rec_id, record['proxied']))

# Вкл/Выкл Прокси
@dp.callback_query(F.data.startswith("proxy_"))
async def toggle_proxy_handler(callback: types.CallbackQuery):
    rec_id = callback.data.split("_")[1]
    records = await CloudflareManager.get_dns_records()
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if record:
        res = await CloudflareManager.toggle_proxy(rec_id, record['proxied'], record)
        if res.get("success"):
            new_proxied = not record['proxied']
            await callback.answer("Статус прокси изменен")
            # Обновляем view
            info = (
                f"<b>ID:</b> {record['id']}\n"
                f"<b>Name:</b> {record['name']}\n"
                f"<b>Type:</b> {record['type']}\n"
                f"<b>Content:</b> {record['content']}\n"
                f"<b>Proxied:</b> {'Да' if new_proxied else 'Нет'}"
            )
            await callback.message.edit_text(info, reply_markup=get_record_keyboard(rec_id, new_proxied))
        else:
            await callback.answer(f"Ошибка: {res.get('errors')[0]['message']}", show_alert=True)

# Изменение IP
@dp.callback_query(F.data.startswith("editip_"))
async def edit_ip_start(callback: types.CallbackQuery, state: FSMContext):
    rec_id = callback.data.split("_")[1]
    await state.update_data(rec_id=rec_id)
    await callback.message.answer("Введите новый IP адрес:")
    await state.set_state(Form.waiting_for_new_ip)
    await callback.answer()

@dp.message(Form.waiting_for_new_ip)
async def edit_ip_finish(message: types.Message, state: FSMContext):
    data = await state.get_data()
    rec_id = data['rec_id']
    new_ip = message.text.strip()
    
    records = await CloudflareManager.get_dns_records()
    record = next((r for r in records if r['id'] == rec_id), None)
    
    if record:
        res = await CloudflareManager.change_ip(rec_id, new_ip, record)
        if res.get("success"):
            await message.answer(f"IP изменен на {new_ip}")
            await message.answer("Меню:", reply_markup=get_main_keyboard())
        else:
            await message.answer(f"Ошибка API: {res.get('errors')}")
    
    await state.clear()

# Удаление
@dp.callback_query(F.data.startswith("del_"))
async def delete_record_handler(callback: types.CallbackQuery):
    rec_id = callback.data.split("_")[1]
    res = await CloudflareManager.delete_record(rec_id)
    if res.get("success"):
        await callback.answer("Запись удалена")
        await show_dns_list(callback)
    else:
        await callback.answer("Ошибка удаления", show_alert=True)

# Добавление
@dp.callback_query(F.data == "add_dns_start")
async def add_dns_start(callback: types.CallbackQuery, state: FSMContext):
    await callback.message.answer("Введите имя поддомена (например: app):")
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
    name = data['name']
    ip = message.text.strip()
    
    res = await CloudflareManager.add_record(name, ip)
    if res.get("success"):
        await message.answer(f"Запись {name} -> {ip} добавлена!")
    else:
        await message.answer(f"Ошибка: {res.get('errors')}")
    
    await state.clear()
    await message.answer("Меню:", reply_markup=get_main_keyboard())

# Запуск
async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
