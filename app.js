/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
const CONFIG = {
    CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRKIkR8jhqNWOgDx3-gwL25i0YFhf5y47Eu01jaCN4IleQPT_DKh0WBjopaDBywqpL0Hz_d0vetQAK8/pub?output=csv",
    WHATSAPP: "5493704812504",
    // Horarios de atención: Array de turnos [{abre: "HH:MM", cierra: "HH:MM"}]
    HORARIO: {
        0: [{ abre: "08:30", cierra: "14:00" }, { abre: "17:00", cierra: "23:00" }], // Domingo
        1: null, // Lunes
        2: [{ abre: "08:30", cierra: "14:00" }, { abre: "17:00", cierra: "23:00" }], // Martes
        3: [{ abre: "08:30", cierra: "14:00" }, { abre: "17:00", cierra: "23:00" }], // Miércoles
        4: [{ abre: "08:30", cierra: "14:00" }, { abre: "17:00", cierra: "23:00" }], // Jueves
        5: [{ abre: "08:30", cierra: "14:00" }, { abre: "17:00", cierra: "07:00" }], // Viernes
        6: [{ abre: "08:30", cierra: "14:00" }, { abre: "17:00", cierra: "07:00" }], // Sábado
    },
    DIAS: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    PROMOS: [
        { icono: "🍻", texto: "¡Combos para la previa!", descripcion: "Revisá nuestra categoría de combos." },
        { icono: "❄️", texto: "Bebidas bien frías", descripcion: "Las mejores marcas siempre a temperatura perfecta." },
    ],
    GALLERY: [
        { url: "assets/image copy.png", caption: "Nuestro local en Av. Italia" },
        { url: "assets/449860129_488919840316079_8242876178337059947_n.jpg", caption: "La variedad que buscás" },
    ],
};

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
let productosDB = [];
let categorias = new Map(); // Map<nombre, {icono, count}>
let carrito = [];
let metodoEntrega = "Envío a domicilio";
let searchTimeout = null;

/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================ */
function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

/* ============================================================
   TEMA (LIGHT/DARK)
   ============================================================ */
function loadTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        btn.title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    }
}

/* ============================================================
   HORARIO ABIERTO/CERRADO
   ============================================================ */
function checkHorario() {
    const now = new Date();
    const dia = now.getDay();
    const hora = now.getHours();
    const minutos = now.getMinutes();
    const horaActualMinutos = hora * 60 + minutos;

    const turnosHoy = CONFIG.HORARIO[dia];
    const badge = document.getElementById('status-badge');
    const text = document.getElementById('status-text');
    const heroCta = document.getElementById('hero-cta');

    if (!turnosHoy || turnosHoy.length === 0) {
        badge.className = 'status-badge cerrado';
        text.textContent = 'Cerrado hoy';
        if (heroCta) {
            heroCta.classList.add('cerrado');
            heroCta.textContent = 'Cerrado hoy';
        }
        return;
    }

    let abierto = false;
    let proximoTurno = null;

    for (const turno of turnosHoy) {
        const [abreH, abreM] = turno.abre.split(':').map(Number);
        const [cierraH, cierraM] = turno.cierra.split(':').map(Number);
        
        const abreTotalMinutos = abreH * 60 + abreM;
        let cierraTotalMinutos = cierraH * 60 + cierraM;

        if (cierraTotalMinutos < abreTotalMinutos) {
            // Cierra al día siguiente (ej. de 17:00 a 07:00)
            if (horaActualMinutos >= abreTotalMinutos || horaActualMinutos < cierraTotalMinutos) {
                abierto = true;
                proximoTurno = turno;
                break;
            }
        } else {
            // Rango dentro del mismo día
            if (horaActualMinutos >= abreTotalMinutos && horaActualMinutos < cierraTotalMinutos) {
                abierto = true;
                proximoTurno = turno;
                break;
            }
        }
        
        if (abreTotalMinutos > horaActualMinutos && !proximoTurno) {
            proximoTurno = turno;
        }
    }

    if (abierto) {
        badge.className = 'status-badge abierto';
        text.textContent = `Abierto · Cierra ${proximoTurno.cierra}hs`;
        if (heroCta) {
            heroCta.classList.remove('cerrado');
            heroCta.textContent = 'Hacer mi pedido';
            heroCta.href = '#productos';
        }
    } else {
        badge.className = 'status-badge cerrado';
        if (proximoTurno) {
            text.textContent = `Cerrado · Abre ${proximoTurno.abre}hs`;
            if (heroCta) {
                heroCta.classList.add('cerrado');
                heroCta.textContent = `Cerrado · Abre a las ${proximoTurno.abre}`;
            }
        } else {
            text.textContent = 'Cerrado';
            if (heroCta) {
                heroCta.classList.add('cerrado');
                heroCta.textContent = 'Cerrado por hoy';
            }
        }
    }
}

function renderFooterHours() {
    const container = document.getElementById('footer-hours');
    if (!container) return;
    let html = '';
    
    // De martes a domingo
    const ordenDias = [1, 2, 3, 4, 5, 6, 0]; 
    ordenDias.forEach(i => {
        const turnos = CONFIG.HORARIO[i];
        let textoTurnos = 'Cerrado';
        if (turnos && turnos.length > 0) {
            textoTurnos = turnos.map(t => `${t.abre} - ${t.cierra}`).join(' y ');
        }
        html += `<div class="hours-item"><span class="day">${CONFIG.DIAS[i]}</span><span>${textoTurnos}</span></div>`;
    });
    container.innerHTML = html;
}

/* ============================================================
   PROMOS
   ============================================================ */
function renderPromos() {
    if (!CONFIG.PROMOS || CONFIG.PROMOS.length === 0) return;
    const banner = document.getElementById('promo-banner');
    if (!banner) return;
    const promo = CONFIG.PROMOS[Math.floor(Math.random() * CONFIG.PROMOS.length)];
    document.getElementById('promo-icon').textContent = promo.icono || '🔥';
    document.getElementById('promo-text').textContent = promo.texto;
    document.getElementById('promo-desc').textContent = promo.descripcion || '';
    banner.classList.add('visible');
}

function cerrarPromo() {
    const banner = document.getElementById('promo-banner');
    if (banner) banner.classList.remove('visible');
}

/* ============================================================
   HAMBURGER MENU
   ============================================================ */
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const hamburger = document.getElementById('hamburger');
    if (!menu || !hamburger) return;
    menu.classList.toggle('open');
    hamburger.classList.toggle('active');
    document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const hamburger = document.getElementById('hamburger');
    if (menu) menu.classList.remove('open');
    if (hamburger) hamburger.classList.remove('active');
    document.body.style.overflow = '';
}

/* ============================================================
   CSV PARSER ROBUSTO
   ============================================================ */
function parsearCSV(csvText) {
    const filas = [];
    let filaActual = [];
    let campoActual = '';
    let dentroComillas = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const siguiente = csvText[i + 1];

        if (dentroComillas) {
            if (char === '"' && siguiente === '"') {
                campoActual += '"';
                i++;
            } else if (char === '"') {
                dentroComillas = false;
            } else {
                campoActual += char;
            }
        } else {
            if (char === '"') {
                dentroComillas = true;
            } else if (char === ',') {
                filaActual.push(campoActual.trim());
                campoActual = '';
            } else if (char === '\n' || (char === '\r' && siguiente === '\n')) {
                filaActual.push(campoActual.trim());
                if (filaActual.some(c => c !== '')) filas.push(filaActual);
                filaActual = [];
                campoActual = '';
                if (char === '\r') i++;
            } else {
                campoActual += char;
            }
        }
    }
    filaActual.push(campoActual.trim());
    if (filaActual.some(c => c !== '')) filas.push(filaActual);
    return filas;
}

function procesarCSV(csvText) {
    const filas = parsearCSV(csvText);
    if (filas.length <= 1) return;

    const ICONOS_DEFAULT = {
        'Cervezas': '🍺', 'Vinos': '🍷', 'Destilados': '🥃', 'Licores': '🍸',
        'Sin Alcohol': '🥤', 'Gaseosas': '🥤', 'Energizantes': '⚡', 'Snacks': '🍫',
        'Minimercado': '🏪', 'Bazar': '🎁', 'Combos': '🎁', 'Conservadoras': '📦'
    };

    productosDB = [];
    categorias.clear();

    for (let i = 1; i < filas.length; i++) {
        const v = filas[i];
        if (v.length >= 4) {
            const cat = v[0] || "Otros";
            let stock = -1;
            if (v[4] !== undefined && v[4] !== '') {
                const parsed = parseInt(v[4], 10);
                if (!isNaN(parsed)) stock = parsed;
            }

            if (!categorias.has(cat)) {
                const iconoSheet = (v[5] && v[5].trim()) ? v[5].trim() : null;
                categorias.set(cat, {
                    icono: iconoSheet || ICONOS_DEFAULT[cat] || '🍾',
                    count: 0
                });
            }
            categorias.get(cat).count++;

            const imagen = (v[6] && v[6].trim()) ? v[6].trim() : '';

            productosDB.push({
                id: i,
                categoria: cat,
                nombre: v[1] || "Producto",
                descripcion: v[2] || "",
                precio: v[3] ? parseFloat(v[3].replace(/[^0-9.-]+/g, "")) : 0,
                stock: stock,
                imagen: imagen
            });
        }
    }
    renderizarCategorias();
}

function renderizarCategorias() {
    const grid = document.getElementById('categorias-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let index = 0;
    categorias.forEach((data, cat) => {
        const card = document.createElement('div');
        card.className = `product-card reveal active`;
        card.style.transitionDelay = `${(index % 3) * 0.1}s`;
        card.onclick = () => abrirModalCategoria(cat);
        card.innerHTML = `
            <div class="product-icon">${data.icono}</div>
            <h3>${cat}</h3>
            <p>Ver opciones de ${cat.toLowerCase()}.</p>
            <span class="product-count">${data.count} ${data.count === 1 ? 'producto' : 'productos'}</span>
        `;
        grid.appendChild(card);
        index++;
    });
}

/* ============================================================
   BÚSQUEDA
   ============================================================ */
function handleSearch(query) {
    clearTimeout(searchTimeout);
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

    searchTimeout = setTimeout(() => {
        const resultsContainer = document.getElementById('search-results');
        const resultsGrid = document.getElementById('search-results-grid');
        const resultsTitle = document.getElementById('search-results-title');
        const categoriesGrid = document.getElementById('categorias-grid');

        if (!resultsContainer || !resultsGrid || !categoriesGrid) return;

        if (!query.trim()) {
            resultsContainer.classList.remove('visible');
            categoriesGrid.style.display = '';
            return;
        }

        const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const resultados = productosDB.filter(p => {
            const nombre = p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const desc = p.descripcion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const cat = p.categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return nombre.includes(q) || desc.includes(q) || cat.includes(q);
        });

        categoriesGrid.style.display = 'none';
        resultsContainer.classList.add('visible');
        resultsTitle.textContent = resultados.length > 0
            ? `${resultados.length} resultado${resultados.length > 1 ? 's' : ''} para "${query}"`
            : `Sin resultados para "${query}"`;

        resultsGrid.innerHTML = '';
        resultados.forEach(prod => {
            const agotado = prod.stock === 0;
            const card = document.createElement('div');
            card.className = 'modal-product-card' + (agotado ? ' agotado' : '');

            let stockHTML = '';
            if (agotado) stockHTML = '<span class="stock-badge agotado">⛔ Agotado</span>';
            else if (prod.stock > 0 && prod.stock <= 5) stockHTML = `<span class="stock-badge pocas">🔥 Últimas ${prod.stock}</span>`;
            else if (prod.stock > 5) stockHTML = '<span class="stock-badge disponible">✓ Disponible</span>';

            let imgHTML = prod.imagen ? `<img class="product-img" src="${prod.imagen}" alt="${prod.nombre}" onerror="this.style.display='none'" loading="lazy">` : '';

            card.innerHTML = `
                ${imgHTML}
                <div class="card-content">
                    <h4>${prod.nombre}</h4>
                    <p style="font-size: 0.7rem; color: var(--primary); margin-bottom: 5px; text-transform: uppercase;">${prod.categoria}</p>
                    ${stockHTML}
                    <p style="color: var(--text-muted); font-size: 0.9rem;">${prod.descripcion}</p>
                    <p class="price">$${prod.precio.toLocaleString('es-AR')}</p>
                    <button class="add-to-cart-btn" onclick="agregarAlCarrito(${prod.id}, event)" ${agotado ? 'disabled' : ''}>${agotado ? 'Sin stock' : 'Añadir al pedido'}</button>
                </div>
            `;
            resultsGrid.appendChild(card);
        });
    }, 250);
}

function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) {
        input.value = '';
        handleSearch('');
    }
}

/* ============================================================
   MODALES
   ============================================================ */
function cerrarTodo() {
    document.getElementById('category-modal').classList.remove('open');
    document.getElementById('cart-sidebar').classList.remove('open');
    document.getElementById('ui-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

function abrirModalCategoria(cat) {
    const modal = document.getElementById('category-modal');
    const overlay = document.getElementById('ui-overlay');
    const title = document.getElementById('modal-category-title');
    const container = document.getElementById('modal-products-container');

    if (!modal || !overlay || !title || !container) return;

    title.textContent = cat;
    container.innerHTML = '';

    const filtrados = productosDB.filter(p => p.categoria === cat);

    if (filtrados.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; width: 100%;">No hay productos cargados en esta categoría.</p>';
    } else {
        filtrados.forEach(prod => {
            const agotado = prod.stock === 0;
            const card = document.createElement('div');
            card.className = 'modal-product-card' + (agotado ? ' agotado' : '');

            let stockHTML = '';
            if (agotado) stockHTML = '<span class="stock-badge agotado">⛔ Agotado</span>';
            else if (prod.stock > 0 && prod.stock <= 5) stockHTML = `<span class="stock-badge pocas">🔥 Últimas ${prod.stock}</span>`;
            else if (prod.stock > 5) stockHTML = '<span class="stock-badge disponible">✓ Disponible</span>';

            let imgHTML = prod.imagen ? `<img class="product-img" src="${prod.imagen}" alt="${prod.nombre}" onerror="this.style.display='none'" loading="lazy">` : '';

            card.innerHTML = `
                ${imgHTML}
                <div class="card-content">
                    <h4>${prod.nombre}</h4>
                    ${stockHTML}
                    <p style="color: var(--text-muted); font-size: 0.9rem;">${prod.descripcion}</p>
                    <p class="price">$${prod.precio.toLocaleString('es-AR')}</p>
                    <button class="add-to-cart-btn" onclick="agregarAlCarrito(${prod.id}, event)" ${agotado ? 'disabled' : ''}>${agotado ? 'Sin stock' : 'Añadir al pedido'}</button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    document.getElementById('cart-sidebar').classList.remove('open');
    overlay.classList.add('open');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function cerrarModalCategoria() {
    document.getElementById('category-modal').classList.remove('open');
    document.getElementById('ui-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

/* ============================================================
   CARRITO
   ============================================================ */
function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('ui-overlay');
    const modal = document.getElementById('category-modal');
    if (!sidebar || !overlay || !modal) return;
    
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    } else {
        modal.classList.remove('open');
        sidebar.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function seleccionarMetodo(metodo, btn) {
    metodoEntrega = metodo;
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const campoDireccion = document.getElementById('campo-direccion');
    if (campoDireccion) campoDireccion.style.display = metodo === 'Retiro en local' ? 'none' : 'block';
}

function irACheckout() {
    if (carrito.length === 0) {
        showToast('Tu carrito está vacío.', 'warning');
        return;
    }
    document.getElementById('step-1').classList.remove('active');
    document.getElementById('step-2').classList.add('active');
    document.getElementById('cart-title').textContent = "Finalizar Pedido";
}

function volverAlCarrito() {
    document.getElementById('step-2').classList.remove('active');
    document.getElementById('step-1').classList.add('active');
    document.getElementById('cart-title').textContent = "Tu Pedido";
}

function toggleVuelto() {
    const pago = document.getElementById('form-pago').value;
    const campo = document.getElementById('campo-vuelto');
    if (campo) campo.style.display = pago === 'Efectivo' ? 'block' : 'none';
}

function flyToCart(event) {
    if (!event || !event.target) return;
    const btn = event.target;
    const rect = btn.getBoundingClientRect();
    const cartBadge = document.getElementById('cart-count-badge');
    if (!cartBadge) return;
    const cartRect = cartBadge.getBoundingClientRect();

    const flyer = document.createElement('div');
    flyer.className = 'fly-item';
    flyer.textContent = '🛒';
    flyer.style.left = rect.left + rect.width / 2 + 'px';
    flyer.style.top = rect.top + 'px';
    document.body.appendChild(flyer);

    requestAnimationFrame(() => {
        flyer.style.left = cartRect.left + cartRect.width / 2 + 'px';
        flyer.style.top = cartRect.top + 'px';
        flyer.style.opacity = '0';
        flyer.style.transform = 'scale(0.3)';
    });

    setTimeout(() => {
        cartBadge.style.transform = 'scale(1.4)';
        setTimeout(() => cartBadge.style.transform = 'scale(1)', 200);
    }, 500);

    setTimeout(() => flyer.remove(), 800);
}

function agregarAlCarrito(idProducto, event) {
    const producto = productosDB.find(p => p.id === idProducto);
    if (!producto || producto.stock === 0) return;

    const index = carrito.findIndex(item => item.id === idProducto);

    if (producto.stock > 0) {
        const cantidadEnCarrito = index > -1 ? carrito[index].cantidad : 0;
        if (cantidadEnCarrito >= producto.stock) {
            showToast(`Solo quedan ${producto.stock} unidades de ${producto.nombre}.`, 'warning');
            return;
        }
    }

    if (index > -1) {
        carrito[index].cantidad += 1;
    } else {
        carrito.push({ ...producto, cantidad: 1 });
    }

    actualizarCarrito();
    guardarCarrito();

    if (event) flyToCart(event);

    const btn = event ? event.target : null;
    if (btn) {
        const originalText = btn.innerText;
        btn.innerText = "¡Agregado!";
        btn.style.background = "var(--primary)";
        btn.style.color = "#000";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "transparent";
            btn.style.color = "var(--primary)";
        }, 1000);
    }

    showToast(`${producto.nombre} agregado al pedido`, 'success', 2000);
}

function modificarCantidad(idProducto, delta) {
    const index = carrito.findIndex(item => item.id === idProducto);
    if (index > -1) {
        if (delta > 0) {
            const prod = productosDB.find(p => p.id === idProducto);
            if (prod && prod.stock > 0 && carrito[index].cantidad >= prod.stock) {
                showToast(`Stock máximo: ${prod.stock} unidades`, 'warning');
                return;
            }
        }
        carrito[index].cantidad += delta;
        if (carrito[index].cantidad <= 0) carrito.splice(index, 1);
        actualizarCarrito();
        guardarCarrito();
    }
}

function actualizarCarrito() {
    const container = document.getElementById('cart-items');
    const badge = document.getElementById('cart-count-badge');
    const totalEl = document.getElementById('cart-total-price');
    if (!container || !badge || !totalEl) return;

    container.innerHTML = '';
    let total = 0;
    let cantidadItems = 0;

    if (carrito.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 50px;">Tu pedido está vacío</p>';
    } else {
        carrito.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;
            cantidadItems += item.cantidad;

            const div = document.createElement('div');
            div.className = 'cart-item';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${item.nombre}</h4>
                    <p>$${subtotal.toLocaleString('es-AR')}</p>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="modificarCantidad(${item.id}, -1)">-</button>
                    <span>${item.cantidad}</span>
                    <button class="qty-btn" onclick="modificarCantidad(${item.id}, 1)">+</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    badge.innerText = cantidadItems;
    totalEl.innerText = '$' + total.toLocaleString('es-AR');
}

function guardarCarrito() {
    localStorage.setItem('laitalia_carrito', JSON.stringify(carrito));
}

function cargarCarrito() {
    try {
        const saved = localStorage.getItem('laitalia_carrito');
        if (saved) {
            carrito = JSON.parse(saved);
            actualizarCarrito();
        }
    } catch (e) {
        console.warn('Error al cargar el carrito:', e);
        carrito = [];
    }
}

/* ============================================================
   COMPARTIR PEDIDO
   ============================================================ */
function compartirPedido() {
    if (carrito.length === 0) {
        showToast('Tu pedido está vacío.', 'warning');
        return;
    }

    let texto = '🍻 *Mi pedido en La Italia Cervecería*\n\n';
    let total = 0;
    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        texto += `• ${item.cantidad}x ${item.nombre} — $${subtotal.toLocaleString('es-AR')}\n`;
    });
    texto += `\n💰 *Total: $${total.toLocaleString('es-AR')}*`;

    if (navigator.share) {
        navigator.share({ title: 'Mi Pedido', text: texto }).catch(() => {});
    } else {
        navigator.clipboard.writeText(texto).then(() => {
            showToast('Pedido copiado al portapapeles', 'success');
        }).catch(() => {
            showToast('No se pudo copiar', 'error');
        });
    }
}

/* ============================================================
   ENVIAR PEDIDO POR WHATSAPP
   ============================================================ */
function enviarPedidoWhatsApp() {
    const nombre = document.getElementById('form-nombre').value.trim();
    const direccion = document.getElementById('form-direccion') ? document.getElementById('form-direccion').value.trim() : '';
    const barrio = document.getElementById('form-barrio') ? document.getElementById('form-barrio').value.trim() : '';
    const dpto = document.getElementById('form-dpto') ? document.getElementById('form-dpto').value.trim() : '';
    const pago = document.getElementById('form-pago').value;
    const vuelto = document.getElementById('form-vuelto') ? document.getElementById('form-vuelto').value : '';
    const notas = document.getElementById('form-notas').value.trim();

    if (!nombre) {
        showToast('Por favor, ingresá tu nombre.', 'warning');
        return;
    }
    if (metodoEntrega === 'Envío a domicilio' && !direccion) {
        showToast('Por favor, ingresá tu dirección.', 'warning');
        return;
    }

    let mensaje = `*NUEVO PEDIDO - LA ITALIA CERVECERÍA*\n`;
    mensaje += `----------------------------------\n`;
    mensaje += `*Cliente:* ${nombre}\n`;
    mensaje += `*Pedido para:* ${metodoEntrega}\n`;

    if (metodoEntrega === 'Envío a domicilio') {
        mensaje += `*Dirección:* ${direccion}\n`;
        if (barrio) mensaje += `*Barrio:* ${barrio}\n`;
        if (dpto) mensaje += `*Depto:* ${dpto}\n`;
    }

    mensaje += `*Método de Pago:* ${pago}\n`;
    if (pago === 'Efectivo' && vuelto) mensaje += `*Paga con:* $${vuelto}\n`;
    if (notas) mensaje += `*Notas:* ${notas}\n`;

    mensaje += `----------------------------------\n`;
    mensaje += `*DETALLE DEL PEDIDO:*\n`;

    let total = 0;
    carrito.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        mensaje += `- ${item.cantidad}x ${item.nombre} ($${subtotal.toLocaleString('es-AR')})\n`;
        total += subtotal;
    });

    mensaje += `----------------------------------\n`;
    mensaje += `*TOTAL: $${total.toLocaleString('es-AR')}*`;

    const url = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');

    showToast('¡Pedido enviado! Revisá WhatsApp.', 'success', 4000);
    carrito = [];
    actualizarCarrito();
    guardarCarrito();
    cerrarTodo();

    volverAlCarrito();
    document.getElementById('form-nombre').value = '';
    if (document.getElementById('form-direccion')) document.getElementById('form-direccion').value = '';
    if (document.getElementById('form-barrio')) document.getElementById('form-barrio').value = '';
    if (document.getElementById('form-dpto')) document.getElementById('form-dpto').value = '';
    document.getElementById('form-notas').value = '';
    if (document.getElementById('form-vuelto')) document.getElementById('form-vuelto').value = '';
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    checkHorario();
    setInterval(checkHorario, 60000);
    renderFooterHours();
    renderPromos();

    const yearSpan = document.getElementById('footer-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    cargarCarrito();

    // ── Reveal on scroll ──────────────────────────────────────
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ── Parallax hero ─────────────────────────────────────────
    const parallaxBg = document.getElementById('parallax-bg');
    if (parallaxBg) {
        window.addEventListener('scroll', () => {
            const offset = window.scrollY;
            parallaxBg.style.transform = `scale(1.1) translateY(${offset * 0.3}px)`;
        }, { passive: true });
    }

    // ── Navbar shrink on scroll ───────────────────────────────
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.style.padding = window.scrollY > 50 ? '10px 5%' : '15px 5%';
        }, { passive: true });
    }

    try {
        const response = await fetch(CONFIG.CSV_URL + "&t=" + new Date().getTime(), { cache: "no-store" });
        if (!response.ok) throw new Error("Error HTTP " + response.status);
        const csvText = await response.text();
        procesarCSV(csvText);
    } catch (error) {
        console.error("Error al cargar productos:", error);
        const grid = document.getElementById('categorias-grid');
        if (grid) grid.innerHTML = '<p style="color: #ef4444; text-align: center; width: 100%;">Error al cargar el menú. Por favor, actualizá la página.</p>';
    }
});


if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('Fallo en registro de SW:', err);
    });
}
