#include <stdio.h>
#include <emscripten/emscripten.h>
#include "lame.h"
#include <stdlib.h>

int main(int argc, char ** argv) {
    printf("Encoder WebAssembly loaded\n");
}

EMSCRIPTEN_KEEPALIVE
int get_encoded_max_size(int orig_length) {
    // From the LAME docs:
    // The required mp3buf_size can be computed from num_samples, samplerate and encoding rate, but here is a worst case estimate:
    // mp3buf_size in bytes = 1.25*num_samples + 7200
    return 1.25 * orig_length + 7200 + 0.5;
}

EMSCRIPTEN_KEEPALIVE
lame_global_flags* encoder_init(int sample_rate, int number_of_channels, const char* title,
                                const char* artist, const char* comment) {
    // From the LAME docs:
    // The default (if you set nothing) is a  J-Stereo, 44.1khz
    // 128kbps CBR mp3 file at quality 5.  Override various default settings
    // as necessary, for example:
    lame_global_flags* lgf = lame_init();
    lame_set_mode(lgf, JOINT_STEREO);
    lame_set_num_channels(lgf, number_of_channels);
    lame_set_in_samplerate(lgf, sample_rate);
    lame_set_brate(lgf, 128);
    lame_init_params(lgf);
    //lame_set_quality(gfp,5);   /* 2=high  5 = medium  7=low */
    id3tag_set_title(lgf, title);
    id3tag_set_artist(lgf, artist);
    //id3tag_set_album(lgf, album);
    id3tag_set_comment(lgf, comment);
    return lgf;
}

EMSCRIPTEN_KEEPALIVE
int encoder_encode(lame_global_flags* lgf, float *channel0, int length0,
                   float *channel1, int length1, unsigned char* output_buffer,
                   int output_buffer_max_size) {
    
    int bytes = lame_encode_buffer_ieee_float(lgf, channel0, channel1, length0,
                                              output_buffer, output_buffer_max_size);
    printf("Encoded %d bytes\n", bytes);
    
    return bytes;
}

EMSCRIPTEN_KEEPALIVE
int encoder_finish(lame_global_flags* lgf, unsigned char* output_buffer,
                   int output_buffer_max_size) {
    
    int bytes = lame_encode_flush(lgf, output_buffer, output_buffer_max_size);
    printf("Flushed %d bytes\n", bytes);
    
    return bytes;
}

EMSCRIPTEN_KEEPALIVE
void encoder_close(lame_global_flags* lgf) {
    lame_close(lgf);
}

