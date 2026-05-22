const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 如果不是 FormData，设置 JSON Content-Type
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

// 认证
export const auth = {
  register: (username, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request('/auth/me'),
};

// 娃娃
export const dolls = {
  list: () => request('/dolls'),
  get: (id) => request(`/dolls/${id}`),
  create: (formData) =>
    request('/dolls', { method: 'POST', body: formData }),
  update: (id, formData) =>
    request(`/dolls/${id}`, { method: 'PUT', body: formData }),
  delete: (id) =>
    request(`/dolls/${id}`, { method: 'DELETE' }),
};

// 日记
export const diary = {
  list: (dollId) => request(`/diary/${dollId}`),
  create: (formData) =>
    request('/diary', { method: 'POST', body: formData }),
  update: (id, data) =>
    request(`/diary/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    request(`/diary/${id}`, { method: 'DELETE' }),
};

// 关系
export const relationships = {
  graph: () => request('/relationships'),
  create: (data) =>
    request('/relationships', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    request(`/relationships/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id) =>
    request(`/relationships/${id}`, { method: 'DELETE' }),
};
