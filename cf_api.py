import aiohttp

CF_API_URL = "https://api.cloudflare.com/client/v4"

class CloudflareManager:
    @staticmethod
    def _get_headers(token):
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    @staticmethod
    async def validate_token(token):
        """Проверяет токен, пытаясь получить детали пользователя"""
        headers = CloudflareManager._get_headers(token)
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{CF_API_URL}/user/tokens/verify", headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result", {}).get("status") == "active"
                return False

    @staticmethod
    async def get_zones(token):
        headers = CloudflareManager._get_headers(token)
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{CF_API_URL}/zones", headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result", [])
                return []

    @staticmethod
    async def get_dns_records(token, zone_id):
        headers = CloudflareManager._get_headers(token)
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{CF_API_URL}/zones/{zone_id}/dns_records", headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return data.get("result", [])
                return []

    @staticmethod
    async def update_record(token, zone_id, record_id, data):
        headers = CloudflareManager._get_headers(token)
        async with aiohttp.ClientSession() as session:
            async with session.put(f"{CF_API_URL}/zones/{zone_id}/dns_records/{record_id}", headers=headers, json=data) as resp:
                return await resp.json()

    @staticmethod
    async def toggle_proxy(token, zone_id, record_id, current_state, record_data):
        payload = {
            "type": record_data['type'],
            "name": record_data['name'],
            "content": record_data['content'],
            "proxied": not current_state,
            "ttl": record_data['ttl']
        }
        return await CloudflareManager.update_record(token, zone_id, record_id, payload)

    @staticmethod
    async def change_ip(token, zone_id, record_id, new_ip, record_data):
        payload = {
            "type": record_data['type'],
            "name": record_data['name'],
            "content": new_ip,
            "proxied": record_data['proxied'],
            "ttl": record_data['ttl']
        }
        return await CloudflareManager.update_record(token, zone_id, record_id, payload)

    @staticmethod
    async def add_record(token, zone_id, name, content, rec_type="A", proxied=True):
        headers = CloudflareManager._get_headers(token)
        payload = {
            "type": rec_type,
            "name": name,
            "content": content,
            "proxied": proxied,
            "ttl": 1
        }
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{CF_API_URL}/zones/{zone_id}/dns_records", headers=headers, json=payload) as resp:
                return await resp.json()

    @staticmethod
    async def delete_record(token, zone_id, record_id):
        headers = CloudflareManager._get_headers(token)
        async with aiohttp.ClientSession() as session:
            async with session.delete(f"{CF_API_URL}/zones/{zone_id}/dns_records/{record_id}", headers=headers) as resp:
                return await resp.json()