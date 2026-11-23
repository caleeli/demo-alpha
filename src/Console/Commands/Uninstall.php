<?php

namespace ProcessMaker\Package\DemoAlpha\Console\Commands;

use Illuminate\Console\Command;

class Uninstall extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'demo-alpha:uninstall';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Uninstall Demo Alpha Package';

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $this->info('Demo Alpha package Uninstalled');
    }
}
