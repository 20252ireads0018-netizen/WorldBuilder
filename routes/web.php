<?php

use App\Http\Controllers\AuthController;
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

// ---------- Mundos (exige login) ----------
Route::middleware('auth')->group(function () {
    Route::prefix('/mundos')->name('worldbuilder.')->group(function () {
        Route::get('/', [WorldbuilderController::class, 'index'])->name('index');
        Route::post('/', [WorldbuilderController::class, 'store'])->middleware('throttle:20,1')->name('store');
        Route::post('/exemplo', [WorldbuilderController::class, 'exemplo'])->middleware('throttle:5,1')->name('exemplo');
        Route::get('/{world}', [WorldbuilderController::class, 'show'])->whereNumber('world')->name('show');
        Route::delete('/{world}', [WorldbuilderController::class, 'destroy'])->whereNumber('world')->name('destroy');
    });

    // API JSON do editor 3D (CSRF pela sessão)
    Route::prefix('/api')->name('api.')->middleware('throttle:240,1')->group(function () {
        Route::get('/worlds/{world}/data', [WorldbuilderApiController::class, 'data'])->whereNumber('world')->name('data');
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
