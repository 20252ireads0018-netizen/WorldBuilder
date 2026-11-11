<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PlanosController;
use App\Http\Controllers\WorldbuilderApiController;
use App\Http\Controllers\WorldbuilderController;
use Illuminate\Support\Facades\Route;

Route::get('/', [AuthController::class, 'home'])->name('home');

// ---------- Contas ----------
Route::middleware('guest')->group(function () {
    Route::get('/entrar', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/entrar', [AuthController::class, 'login'])->middleware('throttle:10,1')->name('login.attempt');
    Route::get('/cadastro', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/cadastro', [AuthController::class, 'register'])->middleware('throttle:10,1')->name('register.store');
});
Route::post('/sair', [AuthController::class, 'logout'])->middleware('auth')->name('logout');

// ---------- Aberto a visitantes (cada ação confere se o mundo é público ou se a pessoa foi convidada) ----------
Route::get('/explorar', [WorldbuilderController::class, 'explorar'])->name('worldbuilder.explorar');
Route::get('/mundos/{world}/ver', [WorldbuilderController::class, 'ver'])->whereNumber('world')->name('worldbuilder.ver');
Route::get('/mundos/{world}/capa', [WorldbuilderController::class, 'capa'])->whereNumber('world')->name('worldbuilder.capa');
Route::get('/api/worlds/{world}/data', [WorldbuilderApiController::class, 'data'])
    ->whereNumber('world')->middleware('throttle:120,1')->name('api.data');

// ---------- Planos ----------
Route::get('/planos', [PlanosController::class, 'index'])->name('planos');

// ---------- Mundos (exige login) ----------
Route::middleware('auth')->group(function () {
    Route::post('/planos/{oferta}', [PlanosController::class, 'comprar'])->whereAlpha('oferta')->middleware('throttle:10,1')->name('planos.comprar');
    Route::get('/pagamentos/{pagamento}', [PlanosController::class, 'show'])->name('pagamentos.show');
    Route::post('/pagamentos/{pagamento}/paguei', [PlanosController::class, 'paguei'])->middleware('throttle:10,1')->name('pagamentos.paguei');
    Route::get('/admin/pagamentos', [PlanosController::class, 'admin'])->name('admin.pagamentos');
    Route::post('/admin/pagamentos/{pagamento}/confirmar', [PlanosController::class, 'confirmar'])->name('admin.pagamentos.confirmar');
    Route::post('/admin/pagamentos/{pagamento}/cancelar', [PlanosController::class, 'cancelar'])->name('admin.pagamentos.cancelar');

    Route::prefix('/mundos')->name('worldbuilder.')->group(function () {
        Route::get('/', [WorldbuilderController::class, 'index'])->name('index');
        Route::post('/', [WorldbuilderController::class, 'store'])->middleware('throttle:20,1')->name('store');
        Route::post('/exemplo', [WorldbuilderController::class, 'exemplo'])->middleware('throttle:5,1')->name('exemplo');
        Route::post('/importar', [WorldbuilderController::class, 'importar'])->middleware('throttle:10,1')->name('importar');
        Route::get('/{world}', [WorldbuilderController::class, 'show'])->whereNumber('world')->name('show');
        Route::delete('/{world}', [WorldbuilderController::class, 'destroy'])->whereNumber('world')->name('destroy');
        Route::get('/{world}/exportar', [WorldbuilderController::class, 'exportar'])->whereNumber('world')->name('exportar');
        Route::post('/{world}/copiar', [WorldbuilderController::class, 'copiar'])->whereNumber('world')->middleware('throttle:10,1')->name('copiar');
    });

    // API JSON do editor 3D (CSRF pela sessão)
    Route::prefix('/api')->name('api.')->middleware('throttle:240,1')->group(function () {
        Route::put('/worlds/{world}', [WorldbuilderApiController::class, 'updateWorld'])->whereNumber('world')->name('worlds.update');
        Route::post('/worlds/{world}/cover', [WorldbuilderApiController::class, 'storeCover'])->whereNumber('world')->middleware('throttle:20,1')->name('worlds.cover');
        Route::post('/worlds/{world}/players', [WorldbuilderApiController::class, 'storePlayer'])->whereNumber('world')->middleware('throttle:20,1')->name('players.store');
        Route::put('/worlds/{world}/fog', [WorldbuilderApiController::class, 'updateFog'])->whereNumber('world')->name('worlds.fog');
        Route::put('/worlds/{world}/players/{user}', [WorldbuilderApiController::class, 'updatePlayer'])->whereNumber(['world', 'user'])->name('players.update');
        Route::post('/worlds/{world}/eras', [WorldbuilderApiController::class, 'storeEra'])->whereNumber('world')->middleware('throttle:30,1')->name('eras.store');
        Route::put('/eras/{era}', [WorldbuilderApiController::class, 'updateEra'])->whereNumber('era')->name('eras.update');
        Route::delete('/eras/{era}', [WorldbuilderApiController::class, 'destroyEra'])->whereNumber('era')->name('eras.destroy');
        Route::post('/worlds/{world}/features/restaurar', [WorldbuilderApiController::class, 'restoreFeature'])->whereNumber('world')->name('features.restore');
        Route::delete('/worlds/{world}/players/{user}', [WorldbuilderApiController::class, 'destroyPlayer'])->whereNumber(['world', 'user'])->name('players.destroy');
        Route::post('/worlds/{world}/features', [WorldbuilderApiController::class, 'storeFeature'])->whereNumber('world')->name('features.store');
        Route::put('/features/{feature}', [WorldbuilderApiController::class, 'updateFeature'])->whereNumber('feature')->name('features.update');
        Route::delete('/features/{feature}', [WorldbuilderApiController::class, 'destroyFeature'])->whereNumber('feature')->name('features.destroy');
        Route::post('/features/{feature}/npcs', [WorldbuilderApiController::class, 'storeNpc'])->whereNumber('feature')->name('npcs.store');
        Route::delete('/npcs/{npc}', [WorldbuilderApiController::class, 'destroyNpc'])->whereNumber('npc')->name('npcs.destroy');
        Route::post('/features/{feature}/shops', [WorldbuilderApiController::class, 'storeShop'])->whereNumber('feature')->name('shops.store');
        Route::delete('/shops/{shop}', [WorldbuilderApiController::class, 'destroyShop'])->whereNumber('shop')->name('shops.destroy');
        Route::post('/features/{feature}/items', [WorldbuilderApiController::class, 'storeItem'])->whereNumber('feature')->name('items.store');
        Route::delete('/items/{item}', [WorldbuilderApiController::class, 'destroyItem'])->whereNumber('item')->name('items.destroy');
    });
});
