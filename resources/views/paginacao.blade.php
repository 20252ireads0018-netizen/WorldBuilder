@if ($paginator->hasPages())
    <nav class="paginacao" aria-label="Páginas">
        @if ($paginator->onFirstPage())
            <span class="mut">Anterior</span>
        @else
            <a href="{{ $paginator->previousPageUrl() }}" rel="prev">Anterior</a>
        @endif
        <span>Página {{ $paginator->currentPage() }} de {{ $paginator->lastPage() }}</span>
        @if ($paginator->hasMorePages())
            <a href="{{ $paginator->nextPageUrl() }}" rel="next">Próxima</a>
        @else
            <span class="mut">Próxima</span>
        @endif
    </nav>
@endif
