document.addEventListener('DOMContentLoaded', () => {
    const $ = s => document.querySelector(s);
    const $$ = s => Array.from(document.querySelectorAll(s));

    const api = {
        async request(path, opts = {}) {
            const res = await fetch(`/api/${path}`, opts);
            if (!res.ok) {
                let err;
                try { err = (await res.json()).error; } catch {}
                throw new Error(err || res.statusText);
            }
            return res.status === 204 ? null : res.json();
        },
        get: path => api.request(path),
        post: (path, body) => api.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        put: (path, body) => api.request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        delete: path => api.request(path, { method: 'DELETE' })
    };

    function toast(msg, type = 'info') {
        const t = document.createElement('div');
        t.className = `toast ${type}`;
        t.textContent = msg;
        $('#toasts').append(t);
        setTimeout(() => t.remove(), 3000);
    }

    function confirmDialog(text) {
        return new Promise(res => {
            const modal = $('#modal');
            $('#modal-text').textContent = text;
            modal.classList.remove('hidden');

            function cleanup(result) {
                modal.classList.add('hidden');
                $('#modal-yes').removeEventListener('click', onYes);
                $('#modal-no').removeEventListener('click', onNo);
                res(result);
            }

            function onYes() { cleanup(true); }

            function onNo() { cleanup(false); }

            $('#modal-yes').addEventListener('click', onYes, { once: true });
            $('#modal-no').addEventListener('click', onNo, { once: true });
        });
    }


    const state = {
        presets: [],
        smtpAccounts: [],
        clients: [],
        products: [],
        invoices: [],
        editingClient: null,
        editingProduct: null,
        editingInvoice: null,
        editingPreset: null
    };

    const presetList = $('#preset-list');
    const companyForm = $('#company-form');
    const companyTitle = $('#company-form-title');
    const savePresetBtn = $('#save-preset');
    const cancelEditBtn = $('#cancel-edit');
    const companyName = $('#company-name');
    const companyAddress = $('#company-address');
    const companyEmail = $('#company-email');
    const companyPhone = $('#company-phone');
    let selectedProfile = null;
    let selectedCompany = null;

    async function loadPresets() {
        state.presets = await api.get('presets');
        presetList.innerHTML = '';
        state.presets.forEach(p => {
            const li = document.createElement('li');
            li.dataset.id = p.id;
            li.innerHTML = `
        <span>${p.company_name}</span>
        <button class="btn select-btn">${selectedProfile === p.id ? 'Unselect' : 'Select'}</button>
        <button class="btn edit-btn">Edit</button>
        <button class="btn danger delete-btn">Delete</button>
      `;
            presetList.append(li);
        });
        updateInvoiceButtonState();
    }

    savePresetBtn.addEventListener('click', async() => {
        const data = {
            company_name: companyName.value,
            company_address: companyAddress.value,
            company_email: companyEmail.value,
            company_phone: companyPhone.value
        };
        if (state.editingPreset) {
            await api.put(`presets/${state.editingPreset}`, data);
            toast('Profile updated', 'success');
        } else {
            await api.post('presets', data);
            toast('Profile added', 'success');
        }
        clearPresetForm();
        await loadPresets();
    });

    cancelEditBtn.addEventListener('click', () => {
        clearPresetForm();
    });

    presetList.addEventListener('click', async e => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = Number(li.dataset.id);
        const btn = e.target;
        if (btn.matches('.select-btn')) {
            selectedProfile = selectedProfile === id ? null : id;
            renderPresetSelection();
        }
        if (btn.matches('.edit-btn')) {
            const p = state.presets.find(x => x.id === id);
            state.editingPreset = id;
            companyTitle.textContent = `Edit Company #${id}`;
            savePresetBtn.textContent = 'Update';
            cancelEditBtn.classList.remove('hidden');
            companyName.value = p.company_name;
            companyAddress.value = p.company_address;
            companyEmail.value = p.company_email;
            companyPhone.value = p.company_phone;
        }
        if (btn.matches('.delete-btn')) {
            if (await confirmDialog(`Delete company #${id}?`)) {
                await api.delete(`presets/${id}`);
                toast('Profile deleted', 'info');
                if (selectedProfile === id) selectedProfile = null;
                clearPresetForm();
                await loadPresets();
            }
        }
    });

    function renderPresetSelection() {
        presetList.querySelectorAll('li').forEach(li => {
            const id = Number(li.dataset.id);
            li.querySelector('.select-btn').textContent = selectedProfile === id ? 'Unselect' : 'Select';
        });
        if (selectedProfile) {
            const p = state.presets.find(x => x.id === selectedProfile);
            companyName.value = p.company_name;
            companyAddress.value = p.company_address;
            companyEmail.value = p.company_email;
            companyPhone.value = p.company_phone;
            selectedCompany = p;
        } else {
            clearPresetForm();
            selectedCompany = null;
        }
        updateInvoiceButtonState();
    }

    function clearPresetForm() {
        state.editingPreset = null;
        companyTitle.textContent = 'Add Company';
        savePresetBtn.textContent = 'Save';
        cancelEditBtn.classList.add('hidden');
        companyForm.reset();
    }

    function updateInvoiceButtonState() {
        const btn = $('#create-panel .btn.primary');
        btn.disabled = !selectedCompany;
    }

    const mailEmail = $('#mail-email');
    const mailPass = $('#mail-pass');
    const verifyMailBtn = $('#verify-mail');
    const verifyStatus = $('#verify-status');
    const mailList = $('#mail-list');

    async function loadSmtp() {
        state.smtpAccounts = await api.get('smtp-configs');
        mailList.innerHTML = '';
        state.smtpAccounts.forEach(cfg => {
            const li = document.createElement('li');
            li.innerHTML = `
        <span>${cfg.email}</span>
        <button class="btn primary" data-id="${cfg.id}" data-action="send">Test</button>
        <button class="btn danger" data-id="${cfg.id}" data-action="remove">Remove</button>
      `;
            mailList.append(li);
        });
    }

    verifyMailBtn.addEventListener('click', async() => {
        try {
            await api.post('smtp-configs', { email: mailEmail.value, password: mailPass.value });
            verifyStatus.textContent = '✅';
            toast('SMTP verified', 'success');
            await loadSmtp();
        } catch {
            verifyStatus.textContent = '❌';
            toast('SMTP failed', 'error');
        }
    });

    mailList.addEventListener('click', async e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id,
            action = btn.dataset.action;
        if (action === 'remove') {
            await api.delete(`smtp-configs/${id}`);
            toast('Removed', 'info');
            await loadSmtp();
        }
        if (action === 'send') {
            try {
                const cfg = state.smtpAccounts.find(c => c.id == id);
                await api.post('test-email', cfg);
                toast('Sent', 'success');
            } catch {
                toast('Fail', 'error');
            }
        }
    });

    const clientForm = $('#client-form');
    const clientTitle = $('#client-form-title');
    const clientSearch = $('#client-search');
    const clientsList = $('#clients-list');

    async function loadClients() {
        state.clients = await api.get('clients');
        clientsList.innerHTML = '';
        state.clients.forEach(c => {
            const li = document.createElement('li');
            li.dataset.id = c.id;
            li.innerHTML = `
        <span>${c.name}</span>
        <span>${c.email}</span>
        <button class="btn" data-action="edit">Edit</button>
        <button class="btn danger" data-action="delete">Delete</button>
      `;
            clientsList.append(li);
        });
    }

    clientForm.addEventListener('submit', async e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(clientForm));
        if (state.editingClient) {
            await api.put(`clients/${state.editingClient}`, data);
            toast('Client updated', 'success');
        } else {
            await api.post('clients', data);
            toast('Client added', 'success');
        }
        state.editingClient = null;
        clientTitle.textContent = 'Add Client';
        clientForm.reset();
        await loadClients();
    });

    clientsList.addEventListener('click', async e => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = Number(li.dataset.id),
            action = e.target.dataset.action;
        if (action === 'edit') {
            const c = state.clients.find(x => x.id === id);
            state.editingClient = id;
            clientTitle.textContent = `Edit Client #${id}`;
            clientForm.name.value = c.name;
            clientForm.email.value = c.email;
            clientForm.address.value = c.address;
            clientForm.phone.value = c.phone;
        }
        if (action === 'delete' && await confirmDialog(`Delete client #${id}?`)) {
            await api.delete(`clients/${id}`);
            toast('Client deleted', 'info');
            await loadClients();
        }
    });

    clientSearch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        clientsList.innerHTML = '';
        state.clients
            .filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
            .forEach(c => {
                const li = document.createElement('li');
                li.dataset.id = c.id;
                li.innerHTML = `
          <span>${c.name}</span>
          <span>${c.email}</span>
          <button class="btn" data-action="edit">Edit</button>
          <button class="btn danger" data-action="delete">Delete</button>
        `;
                clientsList.append(li);
            });
    });

    const productForm = $('#product-form');
    const productTitle = $('#product-form-title');
    const productSearch = $('#product-search');
    const productsList = $('#products-list');

    async function loadProducts() {
        state.products = await api.get('products');
        productsList.innerHTML = '';
        state.products.forEach(p => {
            const li = document.createElement('li');
            li.dataset.id = p.id;
            li.innerHTML = `
        <span>${p.name}</span>
        <span>₹${p.price.toFixed(2)}</span>
        <button class="btn" data-action="edit">Edit</button>
        <button class="btn danger" data-action="delete">Delete</button>
      `;
            productsList.append(li);
        });
    }

    productForm.addEventListener('submit', async e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(productForm));
        data.price = parseFloat(data.price);
        if (state.editingProduct) {
            await api.put(`products/${state.editingProduct}`, data);
            toast('Product updated', 'success');
        } else {
            await api.post('products', data);
            toast('Product added', 'success');
        }
        state.editingProduct = null;
        productTitle.textContent = 'Add Product';
        productForm.reset();
        await loadProducts();
    });

    productsList.addEventListener('click', async e => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = Number(li.dataset.id),
            action = e.target.dataset.action;
        if (action === 'edit') {
            const p = state.products.find(x => x.id === id);
            state.editingProduct = id;
            productTitle.textContent = `Edit Product #${id}`;
            productForm.name.value = p.name;
            productForm.description.value = p.description;
            productForm.price.value = p.price;
        }
        if (action === 'delete' && await confirmDialog(`Delete product #${id}?`)) {
            await api.delete(`products/${id}`);
            toast('Product deleted', 'info');
            await loadProducts();
        }
    });

    productSearch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        productsList.innerHTML = '';
        state.products
            .filter(p => p.name.toLowerCase().includes(q))
            .forEach(p => {
                const li = document.createElement('li');
                li.dataset.id = p.id;
                li.innerHTML = `
          <span>${p.name}</span>
          <span>₹${p.price.toFixed(2)}</span>
          <button class="btn" data-action="edit">Edit</button>
          <button class="btn danger" data-action="delete">Delete</button>
        `;
                productsList.append(li);
            });
    });

    const invClientSearch = $('#invoice-client-search');
    const invClientResults = $('#invoice-client-results');
    const invClientId = $('#invoice-client-id');
    const invClientDisplay = $('#invoice-client-display');
    const invProdSearch = $('#invoice-product-search');
    const invProdResults = $('#invoice-product-results');
    const invItems = $('#invoice-items');
    const invDate = $('#invoice-date');
    const invError = $('#invoice-error');
    const invList = $('#invoices-list');
    const invSearch = $('#invoice-search');

    async function loadInvoices() {
        state.invoices = await api.get('invoices');
        invList.innerHTML = '';
        state.invoices.forEach(inv => {
            const li = document.createElement('li');
            li.dataset.id = inv.id;
            li.innerHTML = `
        <span>#${inv.id}</span>
        <span>${inv.client}</span>
        <span>${inv.date}</span>
        <span>₹${inv.total.toFixed(2)}</span>
        <button class="btn" data-action="pdf">PDF</button>
        <button class="btn" data-action="email">Email</button>
        <button class="btn danger" data-action="delete">Delete</button>
      `;
            invList.append(li);
        });
    }

    invClientSearch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        invClientResults.innerHTML = '';
        state.clients
            .filter(c => c.name.toLowerCase().includes(q))
            .forEach(c => {
                const li = document.createElement('li');
                li.textContent = c.name;
                li.addEventListener('click', () => {
                    invClientId.value = c.id;
                    invClientDisplay.textContent = c.name;
                    invClientResults.innerHTML = '';
                    invClientSearch.value = '';
                });
                invClientResults.append(li);
            });
    });

    invProdSearch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        invProdResults.innerHTML = '';
        state.products
            .filter(p => p.name.toLowerCase().includes(q))
            .forEach(p => {
                const li = document.createElement('li');
                li.textContent = p.name;
                li.addEventListener('click', () => {
                    addItemRow(p);
                    invProdResults.innerHTML = '';
                    invProdSearch.value = '';
                });
                invProdResults.append(li);
            });
    });

    function addItemRow(product) {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
      <span>${product.name}</span>
      <input type="number" class="item-qty" min="1" value="1">
      <input type="number" class="unit-price" step="0.01" value="${product.price.toFixed(2)}">
      <button class="remove-item">×</button>
    `;
        row.querySelector('.remove-item').addEventListener('click', () => row.remove());
        invItems.append(row);
    }

    $('#invoice-form').addEventListener('submit', async e => {
        e.preventDefault();
        invError.hidden = true;
        if (!selectedCompany) {
            invError.textContent = 'Please select a company profile first!';
            invError.hidden = false;
            return;
        }
        const client_id = +invClientId.value;
        const date = invDate.value;
        const items = $$('.item-row').map(r => ({
            product_id: state.products.find(p => p.name === r.children[0].textContent).id,
            quantity: +r.querySelector('.item-qty').value,
            unit_price: +r.querySelector('.unit-price').value
        }));
        if (!client_id) {
            invError.textContent = 'Please select a client';
            invError.hidden = false;
            return;
        }
        if (!items.length) {
            invError.textContent = 'Please add at least one product';
            invError.hidden = false;
            return;
        }
        const payload = {
            client_id,
            date,
            company_name: selectedCompany.company_name,
            company_address: selectedCompany.company_address,
            company_email: selectedCompany.company_email,
            company_phone: selectedCompany.company_phone,
            items
        };
        if (state.editingInvoice) {
            await api.put(`invoices/${state.editingInvoice}`, payload);
            toast('Invoice updated', 'success');
        } else {
            const resp = await api.post('invoices', payload);
            toast(`Invoice #${resp.id} created`, 'success');
        }
        invItems.innerHTML = '';
        invDate.value = '';
        state.editingInvoice = null;
        await loadInvoices();
    });

    invList.addEventListener('click', async e => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = Number(li.dataset.id),
            action = e.target.dataset.action;
        if (action === 'pdf') window.open(`/api/invoices/${id}/pdf`, '_blank');
        if (action === 'email') {
            const choice = prompt('Send from which SMTP account?\n' + state.smtpAccounts.map((m, i) => `${i+1}: ${m.email}`).join('\n'));
            const idx = parseInt(choice, 10) - 1;
            if (state.smtpAccounts[idx]) {
                try {
                    await api.post(`invoices/${id}/send`, state.smtpAccounts[idx]);
                    toast('Invoice emailed', 'success');
                } catch {
                    toast('Email failed', 'error');
                }
            }
        }
        if (action === 'delete' && await confirmDialog(`Delete Invoice #${id}?`)) {
            await api.delete(`invoices/${id}`);
            toast('Invoice deleted', 'info');
            await loadInvoices();
        }
    });

    invSearch.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        invList.innerHTML = '';
        state.invoices
            .filter(inv => inv.client.toLowerCase().includes(q) || String(inv.id).includes(q) || inv.date.includes(q))
            .forEach(inv => {
                const li = document.createElement('li');
                li.dataset.id = inv.id;
                li.innerHTML = `
          <span>#${inv.id}</span>
          <span>${inv.client}</span>
          <span>${inv.date}</span>
          <span>₹${inv.total.toFixed(2)}</span>
          <button class="btn" data-action="pdf">PDF</button>
          <button class="btn" data-action="email">Email</button>
          <button class="btn danger" data-action="delete">Delete</button>
        `;
                invList.append(li);
            });
    });

    $('#modal .modal-backdrop').addEventListener('click', () => {
        $('#modal').classList.add('hidden');
    });

    Promise.all([
        loadPresets(),
        loadSmtp(),
        loadClients(),
        loadProducts(),
        loadInvoices()
    ]).catch(console.error);
});