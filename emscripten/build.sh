#!/bin/sh

LAME_VERSION=3.99.5

if ! [ -d "lame-$LAME_VERSION" ]; then
  echo "Please download version $LAME_VERSION of the LAME encoder and tar xvf it here"
  exit -1
fi

if ! [ -x "$(command -v emcc)" ]; then
  echo "Please install emscripten and source environment variables such that the command emcc exists"
  exit -1
fi

if ! [ -f "configure_done" ]; then
  cd lame-$LAME_VERSION
  ./configure
  cd ..
  touch configure_done
fi

emcc wasm_encoder.c \
-O2 \
-s MODULARIZE=1 -s 'EXPORT_NAME="wasmEncoder"' \
-s ALLOW_MEMORY_GROWTH=1 \
-s ERROR_ON_UNDEFINED_SYMBOLS=0 \
-s EXTRA_EXPORTED_RUNTIME_METHODS='["intArrayFromString", "allocate", "ALLOC_NORMAL"]' \
-ffast-math -DHAVE_CONFIG_H -DSTDC_HEADERS \
-Ilame-$LAME_VERSION \
-Ilame-$LAME_VERSION/include \
lame-$LAME_VERSION/libmp3lame/bitstream.c \
lame-$LAME_VERSION/libmp3lame/encoder.c \
lame-$LAME_VERSION/libmp3lame/fft.c \
lame-$LAME_VERSION/libmp3lame/id3tag.c \
lame-$LAME_VERSION/libmp3lame/lame.c \
lame-$LAME_VERSION/libmp3lame/newmdct.c \
lame-$LAME_VERSION/libmp3lame/psymodel.c \
lame-$LAME_VERSION/libmp3lame/presets.c \
lame-$LAME_VERSION/libmp3lame/quantize.c \
lame-$LAME_VERSION/libmp3lame/quantize_pvt.c \
lame-$LAME_VERSION/libmp3lame/reservoir.c \
lame-$LAME_VERSION/libmp3lame/set_get.c \
lame-$LAME_VERSION/libmp3lame/tables.c \
lame-$LAME_VERSION/libmp3lame/takehiro.c \
lame-$LAME_VERSION/libmp3lame/util.c \
lame-$LAME_VERSION/libmp3lame/VbrTag.c \
lame-$LAME_VERSION/libmp3lame/version.c \
-o wasmEncoder.js
mkdir -p ../server/build
mv wasmEncoder.wasm ../server/build/.
mv wasmEncoder.js ../server/build/.

