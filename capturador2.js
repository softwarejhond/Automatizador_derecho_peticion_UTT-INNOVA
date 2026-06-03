//INSTRUCCIONES DE USO:
// 1. Asegúrate de tener Node.js instalado en tu sistema.
// 2. Instala Puppeteer ejecutando: npm install puppeteer
// 3. Crea un archivo usuarios.json con el siguiente formato:
//    [
//      {
//        "cedula": "12345678",
//        "email": "usuario@example.com",
//        "curso": "Nombre del curso",
//        "usuario": "usuario_moodle",
//        "contraseña": "contraseña_moodle"
//      }
//    ] 
// 4. Ejecuta el script con: node capturador2.js
//    O para procesar un solo usuario sin JSON:
//    node capturador2.js <cedula> <curso> <email> <usuario> <contraseña>

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const PUP_DATA = path.join(__dirname, "pup-data");
if (!fs.existsSync(PUP_DATA)) fs.mkdirSync(PUP_DATA, { recursive: true });

// Leer usuarios desde JSON
const archivoUsuarios = path.join(__dirname, "usuarios.json");
let usuarios = [];

if (fs.existsSync(archivoUsuarios)) {
    try {
        usuarios = JSON.parse(fs.readFileSync(archivoUsuarios, "utf-8"));
    } catch (e) {
        console.error("Error al leer usuarios.json:", e.message);
        process.exit(1);
    }
}

// Si se pasan parámetros, usar esos; sino usar el primer usuario del JSON
let cedula, curso, emailBuscar, moodleUser, moodlePass;
let ejecutarDesdeJSON = false;

if (process.argv[2]) {
    // Parámetros pasados desde línea de comandos
    cedula = process.argv[2];
    curso = process.argv[3];
    emailBuscar = process.argv[4];
    moodleUser = process.argv[5];
    moodlePass = process.argv[6];
    
    // Validar que todos los parámetros estén presentes
    if (!cedula || !curso || !emailBuscar || !moodleUser || !moodlePass) {
        console.error("\n❌ ERROR: Parámetros incompletos");
        console.error("Uso: node capturador2.js <cedula> <curso> <email> <usuario> <contraseña>");
        process.exit(1);
    }
} else if (usuarios.length > 0) {
    // Procesar usuarios del JSON uno por uno
    ejecutarDesdeJSON = true;
} else {
    console.error("\n❌ ERROR: No hay usuarios para procesar");
    console.error("Crea un archivo usuarios.json o pasa parámetros");
    process.exit(1);
}

function obtenerChromePath() {
    const chromePaths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
    ];
    for (const p of chromePaths) if (fs.existsSync(p)) return p;
    return null;
}

/* ==========================================================
   FUNCIÓN UNIVERSAL PARA ENCONTRAR BOTONES POR TEXTO
   ========================================================== */
async function findButtonByText(page, textos) {
    return await page.evaluateHandle((textos) => {
        textos = textos.map(t => t.toLowerCase().trim());

        const elementos = [
            ...document.querySelectorAll("a, button, input[type='submit'], input[type='button'], div, span")
        ];

        return elementos.find(el => {
            const t = (el.innerText || el.value || "").toLowerCase().trim();
            return textos.includes(t);
        }) || null;

    }, textos);
}

/* ==========================================================
   BUSCAR Y RESALTAR USUARIO POR EMAIL
   ========================================================== */
async function findAndHighlightUser(page, userEmail) {
    return await page.evaluate((email) => {
        const elements = document.querySelectorAll("*");
        let encontrado = false;
        
        for (let el of elements) {
            const text = el.innerText || el.textContent || "";
            
            // Buscar el email exacto
            if (text.includes(email)) {
                // Resaltar el elemento
                el.style.backgroundColor = "#FFD700";
                el.style.border = "3px solid #FF6347";
                el.style.padding = "10px";
                el.style.boxShadow = "0 0 10px rgba(255, 0, 0, 0.5)";
                
                // Scroll hasta el elemento
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                encontrado = true;
                break;
            }
        }
        
        return encontrado;
    }, userEmail);
}

/* ==========================================================
   PROCESAR USUARIOS DEL JSON
   ========================================================== */
async function procesarUsuariosDelJSON() {
    const usuariosAProcesar = [...usuarios];
    const totalUsuarios = usuariosAProcesar.length;

    console.log(`\n📋 Encontrados ${totalUsuarios} usuarios para procesar\n`);
    
    for (let i = 0; i < totalUsuarios; i++) {
        const usuario = usuariosAProcesar[i];
        const numeroActual = i + 1;
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`⏳ Usuario ${numeroActual}/${totalUsuarios}`);
        console.log(`${'='.repeat(60)}`);
        console.log(`👤 Cédula: ${usuario.cedula}`);
        console.log(`📧 Email: ${usuario.email}`);
        console.log(`📚 Curso: ${usuario.curso}`);
        
        try {
            // Asignar variables globales para este usuario
            cedula = usuario.cedula;
            curso = usuario.curso;
            emailBuscar = usuario.email;
            moodleUser = usuario.usuario;
            moodlePass = usuario.contraseña;
            
            // Ejecutar la automatización
            await ejecutarCapturador();
        } catch (error) {
            console.error(`\n❌ Error:`, error.message);
        }
        
        // Pausa entre usuarios
        if (i < totalUsuarios - 1) {
            console.log("\n⏸ Esperando 3 segundos antes del siguiente usuario...");
            await new Promise(r => setTimeout(r, 3000));
        }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Proceso completado`);
    console.log(`${'='.repeat(60)}\n`);
}

/* ==========================================================
   FUNCIÓN PRINCIPAL DE AUTOMATIZACIÓN
   ========================================================== */
async function ejecutarCapturador() {
    const chromePath = obtenerChromePath();
    const userDataDir = path.join(PUP_DATA, `session_${String(cedula)}_${Date.now()}`);
    fs.mkdirSync(userDataDir, { recursive: true });

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--window-size=1666,768"
        ],
        defaultViewport: { width: 1666, height: 768 },
        userDataDir,
        executablePath: chromePath
    });

    const page = await browser.newPage();

    // LOGIN
    await page.goto("https://talento-tech.uttalento.co/login/index.php", { waitUntil: "networkidle2" });
    await page.type("#username", moodleUser);
    await page.type("#password", moodlePass);

    await Promise.all([
        page.click("#loginbtn"),
        page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);

    // VERIFICAR USUARIO LOGUEADO
    console.log("\n✅ Login exitoso");
    
    // Obtener información del usuario logueado
    const userInfo = await page.evaluate(() => {
        // Buscar email o nombre de usuario
        const elements = document.querySelectorAll("*");
        let userEmail = null;
        
        for (let el of elements) {
            const text = el.innerText || "";
            if (text.includes("@") && text.includes(".")) {
                userEmail = text.match(/[\w\.-]+@[\w\.-]+\.\w+/)?.[0];
                if (userEmail) break;
            }
        }
        return userEmail || moodleUser;
    });
    
    console.log(`👤 Usuario logueado: ${userInfo}`);

    // ABRIR SIDEBAR IZQUIERDO
    try {
        console.log("\n📂 Abriendo barra lateral...");
        await page.evaluate(() => {
            // Buscar y hacer click en el botón de toggle del sidebar
            const toggleBtn = document.querySelector('[data-toggle="drawer"]') ||
                            document.querySelector('[aria-label*="sidebar"]') ||
                            document.querySelector('[aria-label*="navegación"]') ||
                            document.querySelector('button[data-action="toggle-drawer"]');
            if (toggleBtn) {
                toggleBtn.click();
            }
        });
        await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
        console.log("⚠ No se pudo abrir el sidebar automáticamente:", error.message);
    }

    // ENTRAR AL CURSO
    const courseUrl = `https://talento-tech.uttalento.co/course/view.php?id=${curso}`;
    await page.goto(courseUrl, { waitUntil: "networkidle2" });
    await new Promise(r => setTimeout(r, 1500));

    // ABRIR ÍNDICE DEL CURSO (solo si está cerrado)
    try {
        console.log("\n📑 Verificando índice del curso...");
        
        const drawerId = "theme_boost-drawers-courseindex";
        
        // Comprobar si ya está abierto usando la clase del drawer
        const abierto = await page.evaluate((id) => {
            const drawer = document.getElementById(id);
            return drawer ? drawer.classList.contains("show") : false;
        }, drawerId);

        if (abierto) {
            console.log("✅ El índice ya estaba abierto.");
        } else {
            // Selectores que priorizan apuntar directamente al icono exacto
            const selectors = [
                'button[data-target="theme_boost-drawers-courseindex"] i.fa-list',  // Icono exacto dentro del botón
                'button[data-target="theme_boost-drawers-courseindex"] i',          // Cualquier icono en el botón
                'i.fa-list',                                                        // El icono suelto
                '[data-target="theme_boost-drawers-courseindex"] i',                // Icono general de target
                '[data-target="theme_boost-drawers-courseindex"]',                  // El botón por data-target
                '.btn.icon-no-margin[data-target*="courseindex"]',                 // Por clase y target parcial
                'button[data-original-title*="ndice"] i',                           // Buscando por título aproximado
                'button[aria-label*="ndice"] i'                                     // Buscando por aria-label aproximado
            ];

            // Esperar a encontrar uno de los selectores en el DOM
            let selectorEncontrado = null;
            for (const sel of selectors) {
                try {
                    await page.waitForSelector(sel, { timeout: 1000 });
                    selectorEncontrado = sel;
                    break;
                } catch (e) {
                    // Seguir probando el resto de selectores
                }
            }

            if (!selectorEncontrado) {
                console.log("⚠ No se localizó el icono/botón por selectores normales. Se intentará forzado...");
            } else {
                console.log(`✓ Encontrado selector operativo: "${selectorEncontrado}"`);
            }

            let veredictoAbierto = false;
            for (let intento = 1; intento <= 3; intento++) {
                
                if (selectorEncontrado) {
                    // 1. Forzar Hover Real sobre el icono
                    try {
                        const elem = await page.$(selectorEncontrado);
                        if (elem) {
                            await elem.hover();
                            await new Promise(r => setTimeout(r, 400));
                        }
                    } catch (e) {}

                    // 2. Ejecutar Clic físico de Puppeteer en el icono
                    try {
                        await page.click(selectorEncontrado);
                    } catch (e) {
                        // 3. Fallback: Clic inyectado por DOM en icono y botón contenedor
                        await page.evaluate((sel) => {
                            const el = document.querySelector(sel);
                            if (el) {
                                el.click();
                                el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));

                                const btnPadre = el.closest('button');
                                if (btnPadre && btnPadre !== el) {
                                    btnPadre.click();
                                    btnPadre.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
                                }
                            }
                        }, selectorEncontrado);
                    }
                }

                // Esperar a que reaccione la animación de la página
                await new Promise(r => setTimeout(r, 1200));

                // Confirmar si ya se abrió
                veredictoAbierto = await page.evaluate((id) => {
                    const drawer = document.getElementById(id);
                    return drawer ? drawer.classList.contains("show") : false;
                }, drawerId);

                if (veredictoAbierto) {
                    console.log(`✅ Índice abierto con éxito en el intento #${intento}.`);
                    break;
                }
            }

            // ==========================================================
            // FORZADO SUPREMO (Inyección CSS directa si el click falla)
            // ==========================================================
            if (!veredictoAbierto) {
                console.log("⚠ Los clics convencionales fallaron. Procediendo al forzado inyectando clases directamente...");
                veredictoAbierto = await page.evaluate((id) => {
                    const drawer = document.getElementById(id);
                    if (drawer) {
                        // Modificamos las clases para hacerlo visible visualmente
                        drawer.classList.add("show");
                        drawer.classList.remove("closed");
                        
                        // Añadimos ajuste del cuerpo de Moodle (desplaza el contenido principal a la derecha)
                        document.body.classList.add("drawer-open-left");
                        
                        // Sincronizamos accesibilidad
                        const btn = document.querySelector('[data-target="theme_boost-drawers-courseindex"]');
                        if (btn) btn.setAttribute("aria-expanded", "true");
                        
                        return true;
                    }
                    return false;
                }, drawerId);

                if (veredictoAbierto) {
                    console.log("🔥 Forzado de clases CSS exitoso. Menú desplegado y visible.");
                    await new Promise(r => setTimeout(r, 1200));
                } else {
                    console.log("❌ Error fatal: El contenedor del índice de Moodle no existe en el DOM.");
                }
            }
        }
    } catch (error) {
        console.log("⚠ No se pudo procesar el índice del curso:", error.message);
    }

    // BUSCAR Y RESALTAR AL USUARIO EN EL LISTADO
    const emailABuscar = emailBuscar || userInfo;
    console.log(`\n🔍 Buscando usuario ${emailABuscar} en la página...`);
    const userFound = await findAndHighlightUser(page, emailABuscar);
    if (userFound) {
        console.log(`✓ Usuario encontrado y resaltado: ${emailABuscar}`);
        await new Promise(r => setTimeout(r, 1000));
    } else {
        console.log(`⚠ Usuario ${emailABuscar} no encontrado en el listado visual`);
    }

    // QUIZZES A BUSCAR
    const quizzesObjetivo = [
        "Test de Comprensión Teórica",
        "Reto Práctico"
    ];

    let quizzesEncontrados = [];

    // DEBUG: Mostrar todos los enlaces encontrados
    const todosEnlaces = await page.evaluate(() => {
        return [...document.querySelectorAll("a")]
            .map(a => a.innerText.trim())
            .filter(text => text.length > 0 && text.length < 100);
    });
    console.log("📋 Enlaces en la página:", todosEnlaces.slice(0, 30));

    for (let titulo of quizzesObjetivo) {
        console.log(`\n🔍 Buscando: "${titulo}"`);
        
        const url = await page.evaluate((titulo) => {
            const elementos = [...document.querySelectorAll("a")];
            
            for (let a of elementos) {
                const texto = a.innerText.trim();
                
                // Búsqueda exacta
                if (texto === titulo) {
                    return a.href;
                }
                
                // Búsqueda parcial si contiene todas las palabras clave
                const palabrasQuiz = titulo.toLowerCase().split(" ");
                const palabrasTexto = texto.toLowerCase().split(" ");
                const coincide = palabrasQuiz.every(palabra => 
                    palabrasTexto.some(p => p.includes(palabra))
                );
                
                if (coincide) {
                    return a.href;
                }
            }
            
            return null;
        }, titulo);

        if (url) {
            quizzesEncontrados.push({ titulo, url });
            console.log(`✓ Quiz encontrado: "${titulo}" -> ${url}`);
        } else {
            console.log(`✗ Quiz NO encontrado: "${titulo}"`);
        }
    }

    console.log(`\n📊 Total de quizzes encontrados: ${quizzesEncontrados.length}\n`);

    if (quizzesEncontrados.length === 0) {
        console.log("❌ No se encontraron los quizzes requeridos.");
        console.log("Los quiz buscados son:");
        quizzesObjetivo.forEach(q => console.log(`  - ${q}`));
        await browser.close();
        return;
    }

    // CARPETA DE CAPTURAS
    const folder = path.join(__dirname, "capturas", String(cedula));
    fs.mkdirSync(folder, { recursive: true });

    // PROCESAR CADA QUIZ EN LA MISMA PÁGINA
    for (let i = 0; i < quizzesEncontrados.length; i++) {
        const quiz = quizzesEncontrados[i];

        console.log(`\n📌 Procesando quiz ${i + 1}/${quizzesEncontrados.length}: ${quiz.titulo}`);

        try {
            await page.goto(quiz.url, { waitUntil: "networkidle2" });
            await new Promise(r => setTimeout(r, 2000));

            // CAPTURA 1: INICIAL DEL QUIZ
            const filenameQuiz = path.join(folder, `${String(cedula)}_${quiz.titulo.replace(/\s+/g, "_")}_01_INICIAL.png`);
            await page.screenshot({ path: filenameQuiz, fullPage: true });
            console.log("✔ Captura 1 (Inicial) guardada:", filenameQuiz);

            // BUSCAR Y HACER CLIC EN INTENTO/RESULTADO
            const resultadoBtn = await page.evaluate(() => {
                const elementos = [...document.querySelectorAll("a, button")];
                
                // Palabras clave para buscar el resultado
                const palabrasResultado = [
                    "intento", "attempt",
                    "resultado", "result",
                    "ver intento", "view attempt",
                    "calificación", "grade",
                    "revisión", "review"
                ];
                
                for (let elemento of elementos) {
                    const texto = (elemento.innerText || elemento.textContent || "").toLowerCase().trim();
                    if (palabrasResultado.some(palabra => texto.includes(palabra))) {
                        return { texto, existe: true };
                    }
                }
                return null;
            });

            if (resultadoBtn && resultadoBtn.existe) {
                console.log(`➡ Encontrado: ${resultadoBtn.texto}`);
                
                // Hacer clic en el elemento del resultado
                await page.evaluate(() => {
                    const elementos = [...document.querySelectorAll("a, button")];
                    const palabrasResultado = [
                        "intento", "attempt",
                        "resultado", "result",
                        "ver intento", "view attempt",
                        "calificación", "grade",
                        "revisión", "review"
                    ];
                    
                    for (let elemento of elementos) {
                        const texto = (elemento.innerText || elemento.textContent || "").toLowerCase().trim();
                        if (palabrasResultado.some(palabra => texto.includes(palabra))) {
                            elemento.click();
                            break;
                        }
                    }
                });

                // Esperar a que cargue el resultado
                try {
                    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 });
                } catch (e) {
                    console.log("⚠ Timeout en navegación, esperando 2s…");
                    await new Promise(r => setTimeout(r, 2000));
                }

                // CAPTURA 2: RESULTADO DEL QUIZ
                const filenameResultado = path.join(
                    folder,
                    `${String(cedula)}_${quiz.titulo.replace(/\s+/g, "_")}_02_RESULTADO.png`
                );
                await page.screenshot({ path: filenameResultado, fullPage: true });
                console.log("✔ Captura 2 (Resultado) guardada:", filenameResultado);
            } else {
                console.log("⚠ No se encontró resultado/intento para este quiz.");
            }

        } catch (error) {
            console.log(`❌ Error procesando ${quiz.titulo}:`, error.message);
        }

        // Volver al curso si no es el último quiz
        if (i < quizzesEncontrados.length - 1) {
            console.log("↩ Volviendo al curso...");
            try {
                await page.goto(courseUrl, { waitUntil: "networkidle2" });
                await new Promise(r => setTimeout(r, 1500));
            } catch (error) {
                console.log("⚠ Error volviendo al curso:", error.message);
            }
        }
    }

    console.log("\n✅ Proceso completado");
    
    // CERRAR SESIÓN DEL USUARIO
    try {
        console.log("\n🔐 Cerrando sesión del usuario...");
        await page.goto("https://talento-tech.uttalento.co/login/logout.php", { waitUntil: "networkidle2", timeout: 30000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
        console.log("✅ Sesión cerrada");
    } catch (error) {
        console.log("⚠ No se pudo cerrar sesión (continuar):", error.message);
    }
    
    try {
        await browser.close();
    } catch (error) {
        console.log("⚠ Error cerrando navegador:", error.message);
    }
    
    // ELIMINAR USUARIO DEL JSON DESPUÉS DE PROCESAR EXITOSAMENTE
    if (ejecutarDesdeJSON) {
        try {
            console.log("\n🗑 Eliminando usuario del archivo JSON...");
            usuarios = usuarios.filter(u => String(u.cedula) !== String(cedula));
            fs.writeFileSync(archivoUsuarios, JSON.stringify(usuarios, null, 2), "utf-8");
            console.log("✅ Usuario eliminado del JSON");
        } catch (error) {
            console.error("⚠ Error al eliminar usuario del JSON:", error.message);
        }
    }
}

// Ejecutar
(async () => {
    try {
        if (ejecutarDesdeJSON) {
            await procesarUsuariosDelJSON();
        } else {
            await ejecutarCapturador();
        }
    } catch (error) {
        console.error("❌ Error fatal:", error);
        process.exit(1);
    }
})();
