(function () {
    'use strict';

    if (window.rezka_source_loader_ready) return;
    window.rezka_source_loader_ready = true;

    var REZKA_URL =
        'https://gist.githubusercontent.com/ABurnglv/5a9adecdc76d6973a2601febcf1c2c1e/raw/rezka.js';

    var REZKA_DOMAIN = 'https://tv.hdrezka.inc';

    function log(message) {
        console.log('REZKA SOURCE:', message);
    }

    function start() {
        try {
            // Сразу задаём наше рабочее зеркало.
            Lampa.Storage.set('rezka_domain', REZKA_DOMAIN);
        }
        catch (e) {
            log('cannot set domain: ' + e.message);
        }

        /*
         * Загружаем исходник Rezka как текст.
         * Это обход ситуации, когда браузер/Lampa
         * отказывается подключать raw Gist через <script src>.
         */
        fetch(REZKA_URL, {
            cache: 'no-store'
        })
        .then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            return response.text();
        })
        .then(function (code) {
            if (!code || code.length < 100) {
                throw new Error('empty source');
            }

            /*
             * Выполняем полученный JS внутри Lampa.
             */
            (0, eval)(
                code +
                '\n//# sourceURL=lampa-hdrezka-source.js'
            );

            window.rezka_source_loaded = true;

            log('HDRezka loaded');
        })
        .catch(function (error) {
            window.rezka_source_loaded = false;

            log(
                'HDRezka load failed: ' +
                (error && error.message
                    ? error.message
                    : error)
            );
        });
    }

    function bootstrap() {
        if (typeof Lampa === 'undefined') {
            setTimeout(bootstrap, 200);
            return;
        }

        if (window.appready) {
            start();
        }
        else {
            Lampa.Listener.follow('app', function (event) {
                if (event.type === 'ready') {
                    start();
                }
            });
        }
    }

    bootstrap();
})();
