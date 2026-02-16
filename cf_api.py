import aiohttp
import os
from dotenv import load_dotenv

load_dotenv()

CF_API_URL = "https://api.cloudflare.com/client/v4"
headers = {
    "Authorization": f"Bearer {os.getenv('CF_API_TOKEN')}",
    "Content-Type": "application/json"
}
ZONE_ID = os.getenv("CF_ZONE_ID")

class CloudflareManager:
    @staticmethod
    async def get_dns_records():
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{CF_API_URL}/zones/{ZONE_ID}/dns_records", headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result", [])
                return []

    @staticmethod
    async def update_record(record_id, data):
        async with aiohttp.ClientSession() as session:
            async with session.put(f"{CF_API_URL}/zones/{ZONE_ID}/dns_records/{record_id}", headers=headers, json=data) as resp:
                return await resp.json()

    @staticmethod
    async def toggle_proxy(record_id, current_state, record_data):
        # record_data нужен, чтобы сохранить имя, тип и контент, меняя только proxied
        payload = {
            "type": record_data['type'],
            "name": record_data['name'],
            "content": record_data['content'],
            "proxied": not current_state,
            "ttl": record_data['ttl']
        }
        return await CloudflareManager.update_record(record_id, payload)

    @staticmethod
    async def change_ip(record_id, new_ip, record_data):
        payload = {
            "type": record_data['type'],
            "name": record_data['name'],
            "content": new_ip,
            "proxied": record_data['proxied'],
            "ttl": record_data['ttl']
        }
        return await CloudflareManager.update_record(record_id, payload)

    @staticmethod
    async def add_record(name, content, rec_type="A", proxied=True):
        payload = {
            "type": rec_type,
            "name": name,
            "content": content,
            "proxied": proxied,
            "ttl": 1
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{CF_API_URL}/zones/{ZONE_ID}/dns_records", headers=headers, json=payload) as resp:
                return await resp.json()

    @staticmethod
    async def delete_record(record_id):
        async with aiohttp.ClientSession() as session:
            async with session.delete(f"{CF_API_URL}/zones/{ZONE_ID}/dns_records/{record_id}", headers=headers) as resp:
                return await resp.json()
