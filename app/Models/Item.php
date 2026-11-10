<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Item deixado num local ou à venda numa loja. */
class Item extends Model
{
    protected $table = 'wb_items';

    protected $fillable = ['name', 'description', 'price', 'quantity', 'shop_id'];

    protected $casts = ['price' => 'integer', 'quantity' => 'integer'];

    public function feature(): BelongsTo
    {
        return $this->belongsTo(Feature::class, 'feature_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'shop_id');
    }
}
