<?php

use ProcessMaker\Package\DemoAlpha\Http\Controllers\DemoAlphaController;

Route::group(['middleware' => ['auth']], function () {
    Route::get('admin/demo-alpha', [DemoAlphaController::class, 'index'])->name('package.skeleton.index');
    Route::get('demo-alpha', [DemoAlphaController::class, 'index'])->name('package.skeleton.tab.index');
});
