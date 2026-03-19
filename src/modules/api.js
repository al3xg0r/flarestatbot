export const cfApi = async (token, path, method = 'GET', body = null) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
        method,
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'Content-Type': 'application/json' 
        },
        body: body ? JSON.stringify(body) : null
    });
    return await res.json();
};
