<?php

use ProcessMaker\Package\DemoAlpha\Http\Controllers\DemoAlphaController;

Route::group(['middleware' => ['auth:api', 'bindings']], function () {
    Route::get('admin/demo-alpha/fetch', [DemoAlphaController::class, 'fetch'])
        ->name('package.skeleton.fetch');
    Route::apiResource('admin/demo-alpha', DemoAlphaController::class);
});
